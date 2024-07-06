import mongoose, { isValidObjectId } from "mongoose";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../src/models/video.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../src/models/user.model.js";
import { Like } from "../src/models/like.model.js";
import { deleteOnClodinary } from "../src/utils/cloudinary.js";
import { Comment } from "../src/models/comment.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  const pipeline = [];

  if (query) {
    pipeline.push({
      $search: {
        index: "search video",
        text: {
          query: query,
          path: ["title", "description"],
        },
      },
    });
  }

  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "invalid");
    }
    pipeline.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });
  }

  pipeline.push({
    $match: { isPublished: true },
  });

  if (sortBy && sortType) {
    pipeline.push({
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    });
  } else {
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              username: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$ownerDetails",
    }
  );

  const videoAggregate = await Video.aggregate(pipeline)

  const options = {
    page:parseInt(page,10),
    limit:parseInt(page,10)
  }

  const video = await Video.aggregatePaginate(videoAggregate,options)

  return res
  .status(200)
  .json(new ApiResponse(200,video,"video"))
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    await new ApiError(400, "");
  }

  if (!description) {
    await new ApiError(400, "");
  }

  const videoFile = req.files?.videoFile[0].path;
  const thumbnailLocalPath = req.files?.thumbnail[0].path;

  if (!videoFile) {
    await new ApiError(400, "require video");
  }

  if (!thumbnailLocalPath) {
    await new ApiError(400, "require thumbnail");
  }

  const video = await uploadOnCloudinary(videoFile);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoFile) {
    throw new ApiError(400, "Video file not found");
  }

  if (!thumbnail) {
    throw new ApiError(400, "Thumbnail not found");
  }

  const videos = await Video.create({
    title,
    description,
    duration: video.duration,
    video: {
      url: video.url,
      public_id: video.public_id,
    },
    thumbnail: {
      url: thumbnail.url,
      public_id: thumbnail.public_id,
    },
    owner: req.user?._id,
    isPublished: false,
  });

  const videoUploaded = await Video.findById(videos._id);

  if (!videoUploaded) {
    await new ApiError(500, "video");
  }

  return res.status(200).json(new ApiResponse(200, videos, "op"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.body;

  if (!isValidObjectId(videoId)) {
    await new ApiError(400, "valid please");
  }

  const video = await Video.aggregate([
    {
      $match: {
        id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscriber",
            },
          },
          {
            $addFields: {
              subscriberCount: {
                $size: "$subscriber",
              },
              isSubscriber: {
                $cond: {
                  if: { $in: [req.user?._id, "$subscriber.subscriber"] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              "avatar.url": 1,
              subscriberCount: 1,
              isSubscriber: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$likes.like"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        "videoFile.url": 1,
        title: 1,
        description: 1,
        views: 1,
        createdAt: 1,
        duration: 1,
        comments: 1,
        owner: 1,
        likesCount: 1,
        isLiked: 1,
      },
    },

    await Video.findByIdAndUpdate(videoId, {
      $inc: {
        views: 1,
      },
    }),

    await User.findByIdAndUpdate(req.user?._id, {
      $addToSet: {
        watchHistory: videoId,
      },
    }),
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "video fetched sucessfully"));
});

const updatedVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "video is invalid");
  }

  if (!(title && description)) {
    throw new ApiError(400, "title and description are required");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "video is not here");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      400,
      "You can't edit this video as you are not the owner"
    );
  }

  const thumbnailToDelete = video.thumbnail.public_id;
  const thumbnailPath = req.file?.path;

  if (!thumbnailPath) {
    throw new ApiError(400, "thumbnail is required");
  }

  const thumbnail = new uploadOnCloudinary(thumbnailPath);

  if (!thumbnail) {
    throw new ApiError(400, "thumbnail is not found");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: {
          public_id: thumbnail.public_id,
          url: thumbnail.url,
        },
      },
    },
    { new: true }
  );

  if (!updatedVideo) {
    throw new ApiError(400, "updatevideo nahi hui");
  }

  if (updatedVideo) {
    await deleteOnClodinary(thumbnailToDelete);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "update video"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "invalid");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "video not found");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      400,
      "You can't delete this video as you are not the owner"
    );
  }

  const videoDeleted = await Video.findByIdAndDelete(video?._id);

  if (!videoDeleted) {
    throw new ApiError(400, "video not delete");
  }

  await deleteOnClodinary(video.thumbnail.public_id);
  await deleteOnClodinary(video.videoFile.public_id);

  await Like.deleteMany({
    video: videoId,
  });

  await Comment.deleteMany({
    video: videoId,
  });

  return res.status(200).json(new ApiResponse(te200, {}, "video dele"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "invalid");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "video not found");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(
      400,
      "You can't delete this video as you are not the owner"
    );
  }

  const toggle = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: !video?.isPublished,
      },
    },
    { new: true }
  );

  if (!toggle) {
    throw new ApiError(400, "failed to toggle");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { isPublished: toggle.isPublished },
        "toggle successfully"
      )
    );
});
