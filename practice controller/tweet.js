import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../src/models/tweet.model";
import { ApiError } from "../src/utils/apiError";
import { ApiResponse } from "../src/utils/apiResponse";
import { asyncHandler } from "../src/utils/asyncHandler";
import { User } from "../src/models/user.model";

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content) {
    throw new ApiError(400, "it is required");
  }

  const createTweet = await Tweet.create({
    content,
    owner: req.user?._id,
  });

  if (!createTweet) {
    throw new ApiError(500, "failed to create");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, createTweet, "createTweet successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;

  if (!content) {
    throw new ApiError(400, "it is required");
  }

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "invalid");
  }

  const updateTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content,
      },
    },
    { new: true }
  );

  if (!updateTweet) {
    throw new ApiError(500, "failed to update");
  }

  return res.status(200).json(new ApiResponse(200, updateTweet, "updateTweet"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "it is required");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, "it is not find");
  }

  await Tweet.findByIdAndDelete(tweetId);

  return res
    .status(200)
    .json(new ApiResponse(200, { tweetId }, "delete tweet successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new ApiError(400, "it is reuired");
  }

  const userAggregate = await Tweet.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
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
            $project: {
              userName: 1,
              "avatar.url": 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweet",
        as: "likes",
        pipeline: [
          {
            $project: {
              likeBy: 1,
            },
          },
        ],
      },
    },
    {
      $addField:{
        likeCount:{
          $size:"$likes"
        },
        owner:{
          $first:"$owner"
        },
        isLiked:{
          $cond:{
            if:{$in:[req.user?._id,"likes.likeBy"]},
            then:true,
            else:false
          }
        }
      }
    },
    {
      $sort:{
        createAt:-1
      }
    },
    {
      $project:{
        content:1,
        likeCount:1,
        owner:1,
        isLiked:1,
        createdAt:1
      }
    }
  ]);

  return res
  .status(200)
  .json(new ApiResponse(200,userAggregate,"tweet fetched successfully"))
});
