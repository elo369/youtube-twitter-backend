import mongoose from "mongoose";
import { Comment } from "../src/models/comment.model";
import { Video } from "../src/models/video.model";
import { ApiError } from "../src/utils/apiError";
import { asyncHandler } from "../src/utils/asyncHandler";
import { ApiResponse } from "../src/utils/apiResponse";
import { Like } from "../src/models/like.model";

const getVideoComments = asyncHandler(async(req,res)=>{
    const {page=1,limit=10} = req.query
    const {videoId} = req.params

    if (!videoId) {
        throw new ApiError(400,"it is required")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404,"not found")
    }

    const commentAggregate = await Comment.aggregate([
        {
            $match:{
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"owner"
            }
        },
        {
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"comment",
                as:"likes"
            }
        },
        {
            $addFields:{
                owner:{
                    $first:"$owner"
                },
                likeCount:{
                    $size:"$likes"
                },
                isLiked:{
                    $cond:{
                        if:{$in:[req.user?._id,"$likes.likeBy"]},
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
                createdAt:1,
                likesCount:1,
                owner:{
                    username:1,
                    fullname:1,
                    "avatar.url":1
                },
                isLiked:1
            }
        }
    ])

    const options = {
        page:parseInt(page,10),
        limit:parseInt(page,10)
    }

    const comment = await Comment.aggregatePaginate(commentAggregate,options)

    return res
    .status(200)
    .json(new ApiResponse(200,comment,"get comment successfully"))
})

const addComment = asyncHandler(async(req,res)=>{
    const {videoId} = req.params
    const {content} = req.body

    if (!videoId) {
        throw new ApiError(400,"it is required")
    }

    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(404,"not found")
    }

    const comment = await Comment.create({
        content,
        video:videoId,
        owner:req.user?._id
    })

    if (!comment) {
        throw new ApiError(500,"server problem")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,comment,"add comment successfully"))
})

const updateComment = asyncHandler(async(req,res)=>{
    const {commentId} = req.params
    const {content} = req.body

    if (!commentId) {
        throw new ApiError(400,"it is required")
    }

    if (!content) {
        throw new ApiError(400,"it is required")
    }

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(404,"not found")
    }

    const updateComment = await Comment.findByIdAndUpdate(
        comment?._id,
        {
            $set:{
                content
            }
        },
        {new:true}
    )

    if (!updateComment) {
        throw new ApiError(400,"not update")
    }

    return res
    .status(200)
    .json(new ApiResponse(200,updateComment,"update comment"))
})

const deleteComment = asyncHandler(async(req,res)=>{
    const {commentId} = req.params

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(404,"not found")
    }

    if (comment?.owner._id.toString() !== req.user?._id.toString()) {
        throw new ApiError(404,"youre not owner")
    }

    await Comment.findByIdAndDelete(commentId)

    await Like.deleteMany({ 
        comment:commentId,
        likeBy:req.user
    })

    return res
    .status(200)
    .json(new ApiResponse(200,{commentId},"comment id"))
})