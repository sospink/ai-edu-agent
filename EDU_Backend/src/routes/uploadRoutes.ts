import { Router } from 'express';
import { UploadController } from '../controllers/UploadController';
import { uploadImage, uploadImages, uploadFile, handleUploadError } from '../middlewares/upload';

const router = Router();
const uploadController = new UploadController();

// 上传单个图片
router.post('/image', handleUploadError(uploadImage), uploadController.uploadImage);

// 上传多个图片
router.post('/images', handleUploadError(uploadImages), uploadController.uploadImages);

// 上传通用文件
router.post('/file', handleUploadError(uploadFile), uploadController.uploadFile);

// 删除文件
router.delete('/file', uploadController.deleteFile);

export default router;
