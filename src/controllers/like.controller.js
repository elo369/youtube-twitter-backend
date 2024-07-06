import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import {ApiResponse} from "../utils/apiResponse.js";
import {ApiError} from "../utils/apiError.js";
import {asyncHandler} from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async(req,res)=>{
     const {videoId} = req.params;

     if (!isValidObjectId(videoId)) {
        throw new ApiError(400,"Invalid videoId");
     }

     const likeAlready = await Like.findOne({
        video:videoId,
        likeBy:req.user?._id,
     })

     if (likeAlready) {
        await Like.findByIdAndDelete(likeAlready?._id);

        return res
        .status(200)
        .json(new ApiResponse(200,{isLiked:false}));
     }

     await Like.create({
        video:videoId,
        likedBy:req.user?._id,
     });

     return res
     .status(200)
     .json(new ApiResponse(200,{isLiked: true}));
})

const toggleCommentLike = asyncHandler(async(req,res)=>{
    const {commentId} = req.params;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid commentId");
    }

    const likeAlready = await Like.findOne({
        comment:commentId,
        likedBy:req.user?._id,
    })

    if (likeAlready) {
        await Like.findByIdAndDelete(likeAlready?._id);

        return res
        .status(200)
        .json(new ApiResponse(200,{isLiked:false}))
    }

    await Like.create({
        comment:commentId,
        likeBy:req.user?._id,
    })

    return res
    .status(200)
    .json(new ApiResponse(200,{isLiked:true}));
})

const toggleTweetLike = asyncHandler(async(req,res)=>{
    const {tweetId} = req.params;

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweetId");
    }

    const likeAlready = await Like.findOne({
        tweet:tweetId,
        likeBy:req.user?._id
    });

    if (likeAlready) {
        await Like.findByIdAndDelete(likeAlready?._id);

        return res
        .status(200)
        .json(new ApiResponse(200,{tweetId,isLiked:false}))
    }

    await Like.create({
        tweet:tweetId,
        likeBy:req.user?._id,
    })

    return res
    .status(200)
    .json(new ApiResponse(200,{isLiked:true}));
})

const getLikedVideos = asyncHandler(async(req,res)=>{
      const likeVideosAggegate = await Like.aggregate([
        {
            $match:{
                likeBy: new mongoose.Types.ObjectId(req.user?._id)
            },
        },
        {
            $lookup:{
                from:"videos",
                localField:"video",
                foreignField:"_id",
                as:"likedVideo",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"ownerDetails",
                        }
                    },
                    {
                        $unwind:"$ownerDetails",
                    },
                ]
            }
        },
        {
            $unwind:"$likeVideo",
        },
        {
            $sort:{
                createAt:-1,
            },
        },
        {
            $project:{
                _id:0,
                likeVideo:{
                    _id:1,
                    "videoFile.url":1,
                    "thumbnail.url":1,
                    owner:1,
                    title:1,
                    description:1,
                    views:1,
                    duration:1,
                    createdAt:1,
                    isPublished:1,
                    ownerDetails:{
                        username:1,
                        fullname:1,
                        "avatar.url":1,
                    }
                }
            }
        }
      ]);
      
      return res
      .status(200)
      .json(
        new ApiResponse(
            200,
            likeVideosAggegate,
            "liked videos fetched succesfully"
        )
      );
})

export { toggleVideoLike, toggleCommentLike, toggleTweetLike, getLikedVideos };