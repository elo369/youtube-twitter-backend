import mongoose, { Schema } from "mongoose";
import  jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
    {
        userName: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true, 
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowecase: true,
            trim: true, 
        },
        fullName: {
            type: String,
            required: true,
            trim: true, 
            index: true
        },
        avatar: {
            type: String, // cloudinary url
            required: true,
        },
        coverImage: {
            type: String, // cloudinary url
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video"
            },
        ],
        password: {
            type: String,
            required: [true, 'Password is required']
        },
        refreshToken: {
            type: String
        }

    },
    {
        timestamps: true
    }
    
)

//password
userSchema.pre("save", async function (next) {       //pre===hook
    if(!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password,10)
    next()
})
//`userSchema.pre("save", async function (next) { ... })` एक प्री-सेव (pre-save) हुक है जो 
//उपयोगकर्ता के पासवर्ड को सेव (save) करने से पहले हैश करता है यदि पासवर्ड मॉडिफाई किया गया है।

userSchema.methods.isPasswordCorrect=async function (password) {
    return await bcrypt.compare(password,this.password)
}

//token
userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id:this._id,
            email:this.email,
            username:this.username,
            fullname:this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:process.env.ACCESS_TOKEN_EXPIRY,
        }
    )
}

userSchema.methods.generateRefreshToken= function () {
    return jwt.sign(
        {
            _id:this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn:process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

/*
I am a user
I logged in for a website with my credentials (email and password) 
Now I have accessToken and refreshToken set in my browser cookies and also stored in db right.

As a dev i have set expiry as
AT - 2 DAYS
RT- 1 WEEK

I slept for today and come back again to same website tmrw I have AT not expired good don't have to login with credentials. 

I come back after 5 days 
My AT token is expired but RT is not 
Now Since RT is not expired we refresh both AT and RT again

Now AT and RT again has 2 days and 1 week expiry (new token) in cookies and db. 

But let's say I come back after 15 days now BOTH AT AND RT are expired. 
Now user has to login again with his credentials email and password
*/

/*
7 + 2 = 9 nahi 
2 days ke andar aya to nothing to worry
2 days ke baad and 7 days ke andar aya toh refresh AT and RT. 

Meaning
7 days andar aya to logged in rahega 
7 days ke baad logged in nahi rhega
*/

export const User = mongoose.model("User",userSchema)