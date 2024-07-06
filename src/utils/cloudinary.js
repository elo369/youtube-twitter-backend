import { v2 as cloudinary } from "cloudinary";
import fs from "fs"

          
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary= async (localFilePath)=>{
     try {
        if (!localFilePath) return null
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        //file has been uploaded successfully
        //console.log("file is uploaded on cloudinary",response.url)
        fs.unlinkSync(localFilePath)
        return response
     } catch (error) {
        fs.unlinkSync(localFilePath)
        //remove the locally saved temporary file as the upload operations got failed
        return null;
     }
}

// cloudinary.uploader.upload("https://upload.wikimedia.org/wikipedia/commons/a/ae/Olympic_flag.jpg",
//   { public_id: "olympic_flag" }, 
//   function(error, result) {console.log(result); });

const deleteOnClodinary = async (public_id,resource_type="image")=>{
   try{
       if (!public_id) return null;
      
       const result = await cloudinary.uploader.destroy(public_id,{
         resource_type:"${resource_type}"
       });      
   }catch(error){
      console.log("delete on Cloudinary failed",error)
      return error; 
   }

}

export {uploadOnCloudinary,deleteOnClodinary}