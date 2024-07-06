import mongoose from "mongoose";
import { Like } from "../src/models/like.model";
import { ApiError } from "../src/utils/apiError";
import { ApiResponse } from "../src/utils/apiResponse";
import { asyncHandler } from "../src/utils/asyncHandler";


const toggleVideoLike = asyncHandler(async(req,res)=>{
    const {videoId} = req.params

    if (!videoId) {
        throw new ApiError(400,"it is required")
    }

    const likeAlready = await Like.findById({
        videoId,
        likeBy:req.user?._id
    });

    if (likeAlready) {
        await Like.findByIdAndDelete(likeAlready._id);

        return res
        .status(200)
        .json(new ApiResponse(200,{isLiked:false}))
    }

     await Like.create({
        videoId,
        likeBy:req.user?._id
    })

    return res
    .status(200)
    .json(new ApiResponse(200,{isLiked:true}))
})

const toggleCommentLike = asyncHandler(async(req,res)=>{
    const {commentId} = req.params

    if (!commentId) {
        throw new ApiError(400,"it is required")
    }

    const likeAlready = await Like.findById({
        commentId,
        likeBy:req.user?._id
    });

    if (likeAlready) {
        await Like.findByIdAndDelete(likeAlready._id);

        return res
        .status(200)
        .json(new ApiResponse(200,{isLiked:false}))
    }

     await Like.create({
        commentId,
        likeBy:req.user?._id
    })

    return res
    .status(200)
    .json(new ApiResponse(200,{isLiked:true}))
})

const toggleTweetLike = asyncHandler(async(req,res)=>{
    const {tweetId} = req.params

    if (!tweetId) {
        throw new ApiError(400,"it is required")
    }

    const likeAlready = await Like.findById({
        tweetId,
        likeBy:req.user?._id
    });

    if (likeAlready) {
        await Like.findByIdAndDelete(likeAlready._id);

        return res
        .status(200)
        .json(new ApiResponse(200,{isLiked:false}))
    }

     await Like.create({
        commentId,
        likeBy:req.user?._id
    })

    return res
    .status(200)
    .json(new ApiResponse(200,{isLiked:true}))
})

const getLikedVideos = asyncHandler(async(req,res)=>{

    const likeAggregate = await Like.aggregate([
        {
            $match:{
               user : new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"video",
                foreignField:"_id",
                as:"like",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner"
                        }
                    },
                    {
                        $unwind:"$owner"
                    }
                ]
            }
        },
        {
            $unwind:"$like"
        },
        {
            $sort:{
                createAt:-1
            }
        },
        {
            $project:{
                _id:0,
                like:{
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
                    owner:{
                        username:1,
                        fullname:1,
                        "avatar.url":1,
                    }
                }
            }
        }
    ])

    return res
    .status(200)
    .json(new ApiResponse(200,likeAggregate,"like video fetched successfully"))
})