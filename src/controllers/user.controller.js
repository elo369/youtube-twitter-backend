import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken,refreshToken} 

    } catch (error) {
        throw new ApiError(500,"something went wrong while generating access and refresh token")
    }
}
const registerUser = asyncHandler(async (req,res)=> {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    console.log(req.body)
    const {fullName,email,userName,password} = req.body
    //console.log("email: ",email)
    //console.log("fullname: ",fullName)

    if (
        [fullName,email,userName,password].some((field)=> field?.trim() === "")
    ) {
        throw new ApiError(400,"All fields are required")
    }
    console.log(fullName)

    const existedUser = await User.findOne({
        $or:[{userName},{password}]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    console.log(req.files)
    const avatarLocalpath = req.files?.avatar[0]?.path

    let coverImageLocalpath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
       coverImageLocalpath = req.files?.coverImage[0].path
    }

    if (!avatarLocalpath) {
        throw new ApiError(400, "Avatar file required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalpath)
    const coverImage = await uploadOnCloudinary(coverImageLocalpath)

    if (!avatar) {
        throw ApiError(400, "Avatar image is required")
    }

   const user = await User.create({
         fullName,
         avatar: avatar.url,
         coverImage: coverImage.url,
         email,
         password,
        userName: userName.toLowerCase()
    })

    console.log(fullName)
    console.log(password)

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        await new ApiError(500,"Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered Successfully")
    )
})

const loginUser = asyncHandler(async (req,res)=>{
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie

    const {email,userName,password} = req.body

    //usrname or email dala hai ky dekho
    if (!userName && !email) {
        throw new ApiError(400,"username or email is required")
    }

     // Here is an alternative of above code based on logic discussed in video:
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")
        
    // }

    // username or email hai ky database me
    const user = await User.findOne({
        $or:[{userName},{email}]
    })

    // database me nhi hai to
    if (!user) {
        throw new ApiError(404,"User does not exist")
    }

    // password check
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401,"Invalid user credentials")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options={
        httpOnly :true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
         new ApiResponse(
            200,
            {
                user:loggedInUser,accessToken,refreshToken
            },
            "User logged In Successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req,res)=>{
     await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken: undefined
            }
        },
        {
            new : true
        }
      )

     const options ={
        httpOnly:true,
        secure:true
     }

     return res
     .status(200)
     .clearCookie("accessToken",options)
     .clearCookie("refreshToken",options)
     .json(new ApiResponse(200,{},"User logged Out"))
})

const refreshAccessToken  = asyncHandler(async(req,res)=>{
   const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken

   if (!incomingRefreshToken) {
       throw new ApiError(401,"")
   }

   try {
     const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)

     if (!decodedToken) {
        throw new ApiError(401,"")
     }
     const user = await User.findById(decodedToken?._id)

     if (!user) {
        throw new ApiError(401,"Invalid refresh token")
     }

     if (incomingRefreshToken !== user?.refreshToken) {
        throw new ApiError(401,"Refresh token is expired or used")
     }

     const options ={
        httpOnly:true,
        secure:true
     }

     const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id)

     return res
     .status(200)
     .cookie("accessToken",accessToken,options)
     .cookie("refreshToken",newRefreshToken,options)
     .json(
        new ApiResponse(
            200,
            {accessToken,refreshToken:newRefreshToken},
            "Access token refreshed"
        )
     )
   } catch (error) {
          throw new ApiError(401, error?.message || "Invalid refresh token")
   }
   //Access tokens provide temporary access to resources, while refresh tokens allow getting new access tokens without re-login.
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw await ApiError(401,"Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed suuccessfully"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
      return res
      .status(200)
      .json(new ApiResponse(200,req.user,"User fetched successfully"))
})

const updateUserDetails = asyncHandler(async(req,res)=>{
    const {fullName,email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,    //fullName:fullName
                email        //email:email
            },
        },
        {new:true}
    ).select("-password ")

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        user,
        "Account details updated successfully"
    ))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
      const avatarLocalpath = req.file?.path

      if (!avatarLocalpath) {
        throw new ApiError(401,"Avatar file is missing")
      }

      const avatar = await uploadOnCloudinary(avatarLocalpath)

      if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
      }

      const user = await User.findById(req.user._id).select("avatar");

      const avatarToDelete = user.avatar.public_id;
      
      const updatedUser = await User.findByIdAndUpdate(
          req.user?._id,
          {
              $set:{
                   public_id: avatar.public_id,
                    url: avatar.secure_url
                }
            },
            {new:true}
        ).select("-password")


    if (avatarToDelete && updatedUser.avatar.public_id) {
        await deleteOnClodinary(avatarToDelete);
    }

    return res
    .status(200)
    .json(new ApiResponse(200,updatedUser,"Avatar image updated successfully"))
})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
      const coverImageLocalpath = req.file?.path

      if (!coverImageLocalpath) {
        throw new ApiError(401,"Avatar file is missing")
      }

      const coverImage = await uploadOnCloudinary(coverImageLocalpath)

      if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on coverImage")
      }

      const image = await User.findById(req.user._id).select("coverImage")

      const deleteImage = await image.coverImage.public_id
      
      const updateUser = await User.findByIdAndUpdate(
          req.user?._id,
          {
              $set:{
                public_id: coverImage.public_id,
                url: coverImage.secure_url
                }
            },
            {new:true}
        ).select("-password")


    if (deleteImage && updateUser.coverImage.public_id) {
        await deleteOnClodinary(deleteImage)
    }

    return res
    .status(200)
    .json(new ApiResponse(200,updateUser,"Cover image updated successfully"))
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
   const {userName} =req.params

   if (!userName?.trim() ) {
    throw new ApiError(400,"username is missing")
   }

   const channel = await User.aggregate([
    {
        $match:{
            userName:userName?.toLowerCase()
        }        
    },
    {
        $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"channel",
            as:"subscribers"
        }
    },
    {
        $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"subscriber",
            as:"subscribedTo"
        }
    },
    {
        $addFields:{
            subscribersCount:{
                $size:"$subscribers"
            },
            channelsSubscribedToCount:{
                $size:"$subscribedTo"
            },
            isSubscribed:{
                $cond:{
                    if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                    then:true,
                    else:false
                }
            }
        }
    },
    {
        $project:{
            fullName:1,
            userName:1,
            subscribersCount:1,
            channelsSubscribedToCount:1,
            isSubscribed:1,
            avatar:1,
            coverImage:1,
            email:1
        }
    }
   ])

   if (!channel?.length) {
    throw new ApiError(404,"channel does not exist")
   }

   return res
   .status(200)
   .json(
    new ApiResponse(200,channel[0],"User channel fetched succesfully")
   )
})

const getWatchHistory = asyncHandler(async(req,res)=>{
   const user = await User.aggregate([
    {
        $match:{
            _id:new mongoose.Types.ObjectId(req.user._id)
        }
    },
    {
        $lookup:{
            from:"videos",
            localField:"watchHistory",
            foreignField:"_id",
            as:"watchHistory",
            pipeline:[
                {
                    $lookup:{
                        from:"users",
                        localField:"owner",
                        foreignField:"_id",
                        as:"owner",
                        pipeline:[
                            {
                                $project:{
                                    fullName:1,
                                    userName:1,
                                    avatar:1
                                }
                            }
                        ]
                    }
                },
                {
                    $addFields:{
                        owner:{
                            $first:"$owner"
                        }
                    }
                }
            ]
        }
    }
   ])

   return res
   .status(200)
   .json(
    new ApiResponse(200,user[0].watchHistory,"Watch history fetched successfully")
   )
})

/*
Aggregation pipelines lets u perform operations  on the data of ur models. Each pipeline u write let's u basically manipulate ur data however u want. 

Look up is basically left outer join

from: The name of the collection to join

localField: the field in current collection tht u  want to match with the other collection

Foreign Field: the other collection's field tht matches with ur foreign field
*/

/*
Pipeline is used when u need to perform operations on the data not only to join, 
lookup is one of those operations u can perform. Each pipeline I like a stage 
where u can perform only one operation.
*/

export  {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateUserDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
}



/**
 user: 1
 user: 2
user:3

 key: subscriber

 subscriber:1 , ch:A
 subscriber:1 , ch:B
 subscriber:1 , ch:C

 subscriber:2 , ch:A
 subscriber:2 , ch:H
 subscriber:2 , ch:J

 subscriber:3 , ch:L
 */

 /**
  {
  "_id": 1,
  "name": "Amit",
  "watchHistory": [101, 102]
}
{
  "_id": 2,
  "name": "Neha",
  "watchHistory": [103]
}

'''''''''''''
{
  "_id": 101,
  "title": "MongoDB Tutorial"
}
{
  "_id": 102,
  "title": "Aggregation Framework"
}
{
  "_id": 103,
  "title": "Node.js Basics"
}

''''''''''''''''

{
  "_id": 1,
  "name": "Amit",
  "watchHistory": [
    {
      "_id": 101,
      "title": "MongoDB Tutorial"
    },
    {
      "_id": 102,
      "title": "Aggregation Framework"
    }
  ]
}
{
  "_id": 2,
  "name": "Neha",
  "watchHistory": [
    {
      "_id": 103,
      "title": "Node.js Basics"
    }
  ]
}

  */