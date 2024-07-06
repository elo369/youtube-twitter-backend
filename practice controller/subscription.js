import mongoose, { isValidObjectId } from "mongoose";
import { asyncHandler } from "../src/utils/asyncHandler";
import { ApiError } from "../src/utils/apiError";
import { Subscription } from "../src/models/subscription.model";
import { ApiResponse } from "../src/utils/apiResponse";


const toggleSubscription = asyncHandler(async(req,res)=>{
    const {channelId} = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400,"it is invalid")
    }

    const isSubscribed = await Subscription.findById({
        subscriber:req.user?._id,
        channel:channelId
    })

    if (isSubscribed) {
        await Subscription.findByIdAndDelete(isSubscribed?._id)

        return res
        .status(200)
        .json(new ApiResponse(200,{isSubscribed:false},"unsubscribe successfully"))
    }

    await Subscription.create({
        subscriber:req.user?._id,
        channel:chennelId
    })

    return res
    .status(200)
    .json(new ApiResponse(200,{isSubscribed:true},"subscribe successfully"))
})

const getUserChannelSubscribers = asyncHandler(async(req,res)=>{
    const {channelId} = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400,"it is invalid")
    }

    const subscriber = await Subscription.aggregate([
        {
            $match:{
                channelId : new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"subscriber",
                foreignField:"_id",
                as:"subscriber",
                pipeline:[
                    {
                        $lookup:{
                            from:"subscriptions",
                            localField:"_id",
                            foreignField:"channel",
                            as:"subscribedToSubscriber"
                        }
                    },
                    {
                        $addFields:{
                            subscribe:{
                                $cond:{
                                    if:{$in:[channelId,"$subscribedToSubscriber.subscriber"]},
                                    then:true,
                                    else:false
                                }
                            },
                            subscriberCount:{
                                $size:"$subscribedToSubscriber"
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind:"$subscriber",
        },
        {
            $project:{
                _id:0,
                subscriber:{
                    _id:1,
                    userName:1,
                    fullName:1,
                    "avatar.url":1,
                    subscriberCount:1,
                    subscribedToSubscriber:1
                }
            }
        }
    ])

    return res
    .status(200)
    .json(new ApiResponse(200,subscriber,"get user channel subscribers"))
})

const getSubscribedChannels = asyncHandler(async(req,res)=>{
    const {subscriberId} = req.params

    const subscribedChannels = await Subscription.aggregate([
        {
            $match:{
                subscriber:new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"subscriber",
                foreignField:"_id",
                as:"subscribedChannel",
                pipeline:[
                    {
                        $lookup:{
                            from:"videos",
                            localField:"_id",
                            foreignField:"owner",
                            as:"videos"
                        }
                    },
                    {
                        $addFields:{
                            latestVideos:{
                                $last:"$videos"
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind:"$subscribedChannel",
        },
        {
            $project:{
                 _id:0,
                 subscribedChannels:{
                    _id:1,
                    username:1,
                    fullName:1,
                    "avatar.url":1,
                    latestVideos:{
                        _id:1,
                        "videoFile.url":1,
                        "thumbnail.url":1,
                        owner:1,
                        title:1,
                        description:1,
                        duration:1,
                        createdAt:1,
                        views:1
                    }
                 }
            }
        }
    ])

    return res
    .status(200)
    .json(200,subscribedChannels,"subscribe channel")
})


