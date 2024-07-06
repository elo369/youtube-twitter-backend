import mongoose from "mongoose";
import { Subscription } from "../src/models/subscription.model";
import { asyncHandler } from "../src/utils/asyncHandler";
import { Video } from "../src/models/video.model";
import { ApiResponse } from "../src/utils/apiResponse";

const getChannelStats = asyncHandler(async(req,res)=>{
    const {userId} = req.user?._id;

    const totalSubscribtions = await Subscription.aggregate([
        {
            $match:{
                user: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $group:{
                _id:null,
                subscriber:{
                    $sum:1
                }
            }
        }
    ])

    const videos = await Video.aggregate([
        {
            $match:{
                channel:new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"video",
                as:"like"
            }
        },
        {
            $project:{
                totalLikes:{
                    $size:"$like"
                },
                totalViews:"$views",
                totalVideos:1
            }
        },
        {
            $group:{
                totalLikes:{
                    $sum:"$totalLikes"
                },
                totalViews:{
                    $sum:"$totalViews"
                }
            }
        }
    ])
    const channelStats ={
        totalSubscribtions:totalSubscribtions[0]?.subscriber || 0,
        totalLikes:videos[0]?.totalLikes || 0,
        totalVideos:videos[0]?.totalVideos || 0,
        totalViews:videos[0]?.totalViews || 0
    }

    return res
    .status(200)
    .json(new ApiResponse(200,channelStats,"stats successfully"))
})

const getChannelVideos = asyncHandler(async(req,res)=>{
    const {userId} = req.params

    const video = await Video.aggregate([
        {
            $match:{
                user:new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup:{
                from:"likes",
                localField:"_id",
                foreignField:"video",
                as:"like"
            }
        },
        {
            $addFields:{
                likeCount:{
                    $size:"$like"
                },
                createdAt:{
                    $dateToParis:{date:"$createdAt"}
                }
            }
        },
        {
            $sort:{
              createdAt:-1
            }
        },
        {
            $project:{
                _id:1,
                "videoFile.url":1,
                "thumbanail.url":1,
                title:1,
                description:1,
                createdAt:{
                    year:1,
                    month:1,
                    day:1
                },
                isPublished:1,
                likeCount:1
            }
        }
    ])

    return res
    .status(200)
    .json(new ApiResponse(200,video,"Channel stats fetched successfully"))
})
