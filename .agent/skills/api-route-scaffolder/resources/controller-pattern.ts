/**
 * EDU_Backend Controller 规范模板
 * 参考：src/controllers/CourseController.ts
 */
import { Request, Response } from 'express';
import { ExampleService } from '../services/ExampleService';

export class ExampleController {
  private service: ExampleService;

  constructor() {
    this.service = new ExampleService();
  }

  // 获取列表
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const items = await this.service.findAll();
      res.json({ success: true, data: items });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取列表失败';
      res.status(500).json({ success: false, error: message });
    }
  }

  // 获取单个
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const item = await this.service.findById(id);
      if (!item) {
        res.status(404).json({ success: false, error: '资源不存在' });
        return;
      }
      res.json({ success: true, data: item });
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取详情失败';
      res.status(500).json({ success: false, error: message });
    }
  }

  // 创建
  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body;
      const item = await this.service.create(data);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建失败';
      res.status(500).json({ success: false, error: message });
    }
  }

  // 更新
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body;
      const item = await this.service.update(id, data);
      res.json({ success: true, data: item });
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新失败';
      res.status(500).json({ success: false, error: message });
    }
  }

  // 删除
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.service.delete(id);
      res.json({ success: true, message: '删除成功' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败';
      res.status(500).json({ success: false, error: message });
    }
  }
}
