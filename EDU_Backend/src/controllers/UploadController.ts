import { Request, Response } from 'express';
import { sendSuccess, sendBadRequest, sendError } from '../utils/response';
import path from 'path';
import fs from 'fs';

export class UploadController {
  // 上传单个图片
  async uploadImage(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendBadRequest(res, '请选择要上传的图片');
      }

      // 返回可访问的 URL 路径
      const fileUrl = `/uploads/images/${req.file.filename}`;

      return sendSuccess(
        res,
        {
          url: fileUrl,
          filename: req.file.filename,
          originalname: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
        '图片上传成功'
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '图片上传失败';
      return sendError(res, message);
    }
  }

  // 上传多个图片
  async uploadImages(req: Request, res: Response) {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return sendBadRequest(res, '请选择要上传的图片');
      }

      const uploadedFiles = files.map((file) => ({
        url: `/uploads/images/${file.filename}`,
        filename: file.filename,
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      }));

      return sendSuccess(res, uploadedFiles, '图片上传成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '图片上传失败';
      return sendError(res, message);
    }
  }

  // 上传通用文件
  async uploadFile(req: Request, res: Response) {
    try {
      if (!req.file) {
        return sendBadRequest(res, '请选择要上传的文件');
      }

      const fileUrl = `/uploads/files/${req.file.filename}`;

      return sendSuccess(
        res,
        {
          url: fileUrl,
          filename: req.file.filename,
          originalname: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
        '文件上传成功'
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '文件上传失败';
      return sendError(res, message);
    }
  }

  // 删除文件
  async deleteFile(req: Request, res: Response) {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        return sendBadRequest(res, '文件路径不能为空');
      }

      // 安全检查：确保只能删除 uploads 目录下的文件
      if (!filePath.startsWith('/uploads/')) {
        return sendBadRequest(res, '无效的文件路径');
      }

      const absolutePath = path.join(process.cwd(), 'public', filePath);

      // 检查文件是否存在
      if (!fs.existsSync(absolutePath)) {
        return sendBadRequest(res, '文件不存在');
      }

      // 删除文件
      fs.unlinkSync(absolutePath);

      return sendSuccess(res, null, '文件删除成功');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '文件删除失败';
      return sendError(res, message);
    }
  }
}
