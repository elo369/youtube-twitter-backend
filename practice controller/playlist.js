import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../src/models/playList.model.js";
import { ApiError } from "../src/utils/apiError.js";
import { ApiResponse } from "../src/utils/apiResponse.js";
import { asyncHandler } from "../src/utils/asyncHandler.js";
import { Video } from "../src/models/video.model.js";
import { User } from "../src/models/user.model.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name && !description) {
    throw new ApiError(400, "it is required");
  }

  const playlist = await Playlist.create({
    name,
    description,
    owner: req.user?._id,
  });

  if (!playlist) {
    throw new ApiError(500, "server problem");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "create playlist is successfully"));
});

const updatedPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { playlistId } = req.params;

  if (!name && !description) {
    throw new ApiResponse(400, "it is required");
  }

  const playlist = await Playlist.findById(playlistId);

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlist?._id,
    {
      $set: {
        name,
        description,
      },
    },
    { naw: true }
  );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!playlistId) {
    throw new ApiError(400, "it is required");
  }

  const playList = await Playlist.findById(playlistId);

  if (!playList) {
    throw new ApiError(404, "not found");
  }

  if (Playlist?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "your not delete");
  }

  await Playlist.findByIdAndDelete(playList?._id);

  return res.status(200).json(new ApiResponse(200, {}, "delete successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, "invalid playlist or video");
  }

  const playlist = await Playlist.findById(playlistId);
  const video = await Video.findById(videoId);

  if (!playlist) {
    throw new ApiError(404, "playlist not found");
  }

  if (!video) {
    throw new ApiError(404, "video not found");
  }

  if (
    (playlist.owner?.toString() && video.owner.toString()) !==
    req.user?._id.toString()
  ) {
    throw new ApiError(400, "only owner can add video to thier playlist");
  }

  const addVideoToPlaylist = await Playlist.findByIdAndUpdate(
    Playlist?._id,
    {
      $addToSet: {
        videos: videoId,
      },
    },
    { new: true }
  );

  if (!addVideoToPlaylist) {
    throw new ApiError(500, "server problem");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        addVideoToPlaylist,
        "video add into playlist successfully"
      )
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, "invalid playlist or video");
  }

  const playlist = await Playlist.findById(playlistId);
  const video = await Video.findById(videoId);

  if (!playlist) {
    throw new ApiError(404, "playlist not found");
  }

  if (!video) {
    throw new ApiError(404, "video not found");
  }

  if (
    playlist?.owner.toString() &&
    video?.owner.toString() !== req.user?._id.toString()
  ) {
    throw new ApiError(400, "your not owner");
  }

  const removeVideoFromPlaylist = await Playlist.findByIdAndUpdate(
    playlist?._id,
    {
      $pull: {
        video: videoId,
      },
    },
    { new: true }
  );

  if (!removeVideoFromPlaylist) {
    throw new ApiError(500, "server problem");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, removeVideoFromPlaylist, "remove video successfully")
    );
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "it is required");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(400, "not found");
  }

  const playlistAggregate = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
      },
    },
    {
      $match: {
        "videos.isPublished": true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $addFields: {
        totalVideos: {
          $size: "$videos",
        },
        totalViews: {
          $sum: "$videos.views",
        },
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        createAt: 1,
        updatedAt: 1,
        totalVideos: 1,
        totalViews: 1,
        videos: {
          _id: 1,
          "videosFile.url": 1,
          "thumbnail.url": 1,
          title: 1,
          description: 1,
          duration: 1,
          createdAt: 1,
          views: 1,
        },
        owner: {
          username: 1,
          fullname: 1,
          "avatar.url": 1,
        },
      },
    },
  ]);

  if (!playlistAggregate) {
    throw new ApiError(500,"server problem")
  }

  return res
  .status(200)
  .json(new ApiResponse(200,playlistAggregate,"get playlist successfully"))
});

const getUserPlaylists = asyncHandler(async(req,res)=>{
    const {userId} = req.params

    if (!isValidObjectId(userId)) {
        throw new ApiError(400,"it is required")
    }

    const user = await User.findById(userId)

    if (!user) {
        throw new ApiError(404,"not found")
    }

    const playlists = await Playlist.aggregate([
        {
            $match:{
                owner : new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"videos",
                foreignField:"_id",
                as:"videos"
            }
        },
        {
            $addFields:{
                totalVideos:{
                    $size:"$videos"
                },
                totalViews:{
                    $sum:"$videos.views"
                }
            }
        },
        {
            $project:{
                _id:1,
                name:1,
                description:1,
                totalVideos:1,
                totalViews:1,
                updatedAt:1,
            }
        }
    ])

    if (!playlists) {
        throw new ApiError(500,"server problem")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,playlists,"user Aggregate successfully"))
})
