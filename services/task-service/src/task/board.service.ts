import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IBoard } from './schemas/board.schema';
import { ITask } from './schemas/task.schema';
import {
  CreateBoardDto, UpdateBoardDto, AddColumnDto,
  UpdateColumnDto, MoveTaskDto, CreateFromTemplateDto,
} from './dto/board.dto';
import { getBoardTemplates } from './data/board-templates';

@Injectable()
export class BoardService {
  private readonly logger = new Logger(BoardService.name);

  constructor(
    @InjectModel('Board') private boardModel: Model<IBoard>,
    @InjectModel('Task') private taskModel: Model<ITask>,
  ) {}

  async createBoard(dto: CreateBoardDto, userId: string) {
    const type = dto.type || 'kanban';
    let columns = dto.columns;

    // If no columns provided, use template defaults
    if (!columns || columns.length === 0) {
      const templates = getBoardTemplates();
      const template = templates.find((t) => t.type === type);
      if (template) {
        columns = template.columns;
      }
    } else {
      // Ensure each column has an id and order
      columns = columns.map((col, idx) => ({
        id: uuidv4(),
        name: col.name,
        order: col.order ?? idx,
        wipLimit: col.wipLimit ?? 0,
        statusMapping: col.statusMapping || [],
        color: col.color || '#6B7280',
      }));
    }

    const board = new this.boardModel({
      name: dto.name,
      projectId: dto.projectId,
      type,
      columns,
      createdBy: userId,
    });
    await board.save();
    this.logger.log(`Board created: ${board._id} - ${dto.name}`);
    return board;
  }

  async getBoardsByProject(projectId: string) {
    return this.boardModel.find({ projectId, isDeleted: false }).sort({ createdAt: -1 });
  }

  async getBoard(boardId: string) {
    const board = await this.boardModel.findOne({ _id: boardId, isDeleted: false });
    if (!board) throw new NotFoundException('Board not found');
    return board;
  }

  async updateBoard(boardId: string, dto: UpdateBoardDto) {
    const board = await this.boardModel.findOneAndUpdate(
      { _id: boardId, isDeleted: false },
      { ...dto },
      { new: true },
    );
    if (!board) throw new NotFoundException('Board not found');
    this.logger.log(`Board updated: ${boardId}`);
    return board;
  }

  async deleteBoard(boardId: string) {
    const board = await this.boardModel.findOneAndUpdate(
      { _id: boardId, isDeleted: false },
      { isDeleted: true },
      { new: true },
    );
    if (!board) throw new NotFoundException('Board not found');
    this.logger.log(`Board soft-deleted: ${boardId}`);
    return { message: 'Board deleted successfully' };
  }

  async addColumn(boardId: string, dto: AddColumnDto) {
    const board = await this.getBoard(boardId);

    let order: number;
    if (dto.afterColumnId) {
      const afterCol = board.columns.find((c) => c.id === dto.afterColumnId);
      if (!afterCol) throw new BadRequestException('afterColumnId not found');
      order = afterCol.order + 1;
      // Shift columns after this position
      board.columns.forEach((c) => {
        if (c.order >= order) c.order += 1;
      });
    } else {
      order = board.columns.length;
    }

    const newColumn = {
      id: uuidv4(),
      name: dto.name,
      order,
      wipLimit: dto.wipLimit ?? 0,
      statusMapping: dto.statusMapping || [],
      color: dto.color || '#6B7280',
    };

    board.columns.push(newColumn as any);
    board.columns.sort((a, b) => a.order - b.order);
    await board.save();
    this.logger.log(`Column added to board ${boardId}: ${dto.name}`);
    return board;
  }

  async removeColumn(boardId: string, columnId: string) {
    const board = await this.getBoard(boardId);
    const colIndex = board.columns.findIndex((c) => c.id === columnId);
    if (colIndex === -1) throw new NotFoundException('Column not found');

    if (board.columns.length <= 1) {
      throw new BadRequestException('Cannot remove the last column');
    }

    // Move tasks in this column to the first available column
    const firstColumn = board.columns.find((c) => c.id !== columnId);
    await this.taskModel.updateMany(
      { boardId, columnId, isDeleted: false },
      { columnId: firstColumn.id },
    );

    board.columns.splice(colIndex, 1);
    // Re-order remaining columns
    board.columns.sort((a, b) => a.order - b.order);
    board.columns.forEach((c, idx) => (c.order = idx));
    await board.save();
    this.logger.log(`Column ${columnId} removed from board ${boardId}`);
    return board;
  }

  async reorderColumns(boardId: string, columnIds: string[]) {
    const board = await this.getBoard(boardId);

    for (let i = 0; i < columnIds.length; i++) {
      const col = board.columns.find((c) => c.id === columnIds[i]);
      if (!col) throw new BadRequestException(`Column ${columnIds[i]} not found`);
      col.order = i;
    }

    board.columns.sort((a, b) => a.order - b.order);
    await board.save();
    this.logger.log(`Columns reordered on board ${boardId}`);
    return board;
  }

  async updateColumn(boardId: string, columnId: string, dto: UpdateColumnDto) {
    const board = await this.getBoard(boardId);
    const col = board.columns.find((c) => c.id === columnId);
    if (!col) throw new NotFoundException('Column not found');

    if (dto.name !== undefined) col.name = dto.name;
    if (dto.wipLimit !== undefined) col.wipLimit = dto.wipLimit;
    if (dto.color !== undefined) col.color = dto.color;
    if (dto.statusMapping !== undefined) col.statusMapping = dto.statusMapping;

    await board.save();
    this.logger.log(`Column ${columnId} updated on board ${boardId}`);
    return board;
  }

  async moveTask(boardId: string, dto: MoveTaskDto) {
    const board = await this.getBoard(boardId);

    const toColumn = board.columns.find((c) => c.id === dto.toColumnId);
    if (!toColumn) throw new NotFoundException('Target column not found');

    // Check WIP limit
    if (toColumn.wipLimit > 0) {
      const tasksInColumn = await this.taskModel.countDocuments({
        boardId,
        columnId: dto.toColumnId,
        isDeleted: false,
      });
      if (tasksInColumn >= toColumn.wipLimit) {
        throw new BadRequestException(
          `WIP limit reached for column "${toColumn.name}" (max ${toColumn.wipLimit})`,
        );
      }
    }

    // Update the task's columnId and status based on column's statusMapping
    const updateData: any = { columnId: dto.toColumnId };
    if (toColumn.statusMapping && toColumn.statusMapping.length > 0) {
      updateData.status = toColumn.statusMapping[0];
    }

    const task = await this.taskModel.findOneAndUpdate(
      { _id: dto.taskId, isDeleted: false },
      updateData,
      { new: true },
    );
    if (!task) throw new NotFoundException('Task not found');

    this.logger.log(`Task ${dto.taskId} moved to column ${dto.toColumnId} on board ${boardId}`);
    return task;
  }

  async createBoardFromTemplate(projectId: string, templateType: string, userId: string) {
    const templates = getBoardTemplates();
    const template = templates.find((t) => t.type === templateType);
    if (!template) throw new BadRequestException(`Unknown template type: ${templateType}`);

    return this.createBoard(
      { name: template.name, projectId, type: templateType },
      userId,
    );
  }

  getTemplates() {
    return getBoardTemplates().map((t) => ({
      type: t.type,
      name: t.name,
      columnCount: t.columns.length,
      columns: t.columns.map((c) => ({ name: c.name, wipLimit: c.wipLimit, color: c.color })),
    }));
  }
}
