import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IKanbanBoard, IKanbanCard } from './kanban.model';

@Injectable()
export class KanbanService {
  constructor(@InjectModel('KanbanBoard') private boardModel: Model<IKanbanBoard>) {}

  /**
   * Create Kanban board
   */
  async createBoard(
    productId: string,
    boardData: {
      workflowId: string;
      title: string;
      description?: string;
      columns: any[];
    },
  ): Promise<IKanbanBoard> {
    const board = new this.boardModel({
      productId,
      ...boardData,
    });
    return board.save();
  }

  /**
   * Get board by ID
   */
  async getBoard(boardId: string): Promise<IKanbanBoard> {
    const board = await this.boardModel.findById(boardId);
    if (!board) {
      throw new NotFoundException('Board not found');
    }
    return board;
  }

  /**
   * Get board for product
   */
  async getProductBoard(productId: string): Promise<IKanbanBoard> {
    const board = await this.boardModel.findOne({ productId });
    if (!board) {
      throw new NotFoundException('Board not found for product');
    }
    return board;
  }

  /**
   * Update board
   */
  async updateBoard(
    boardId: string,
    updates: Partial<{
      title: string;
      description: string;
      columns: any[];
      settings: any;
    }>,
  ): Promise<IKanbanBoard> {
    const board = await this.getBoard(boardId);
    Object.assign(board, updates);
    return board.save();
  }

  /**
   * Move card between states
   */
  async moveCard(
    boardId: string,
    cardId: string,
    fromStateId: string,
    toStateId: string,
    order: number,
  ): Promise<IKanbanBoard> {
    const board = await this.getBoard(boardId);

    // Find and remove card from source column
    const sourceColumn = board.columns.find(col => col.stateId === fromStateId);
    if (sourceColumn) {
      const cardIndex = sourceColumn.cards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        const [card] = sourceColumn.cards.splice(cardIndex, 1);

        // Add card to target column
        const targetColumn = board.columns.find(col => col.stateId === toStateId);
        if (targetColumn) {
          card.state = toStateId;
          card.order = order;
          targetColumn.cards.push(card);
        }
      }
    }

    return board.save();
  }

  /**
   * Reorder cards in column
   */
  async reorderCards(
    boardId: string,
    stateId: string,
    cardIds: string[],
  ): Promise<IKanbanBoard> {
    const board = await this.getBoard(boardId);

    const column = board.columns.find(col => col.stateId === stateId);
    if (column) {
      const cardMap = new Map(column.cards.map((c, i) => [c.id, { ...c, order: i }]));
      column.cards = cardIds.map((id, i) => {
        const card = cardMap.get(id);
        if (card) {
          card.order = i;
          return card;
        }
        return null;
      }).filter(Boolean);
    }

    return board.save();
  }

  /**
   * Get board statistics
   */
  async getBoardStats(boardId: string): Promise<Record<string, any>> {
    const board = await this.getBoard(boardId);

    const stats = {};
    board.columns.forEach(col => {
      stats[col.stateId] = {
        title: col.title,
        cardCount: col.cards.length,
      };
    });

    return {
      totalCards: board.columns.reduce((sum, col) => sum + col.cards.length, 0),
      columnStats: stats,
    };
  }

  /**
   * Delete board
   */
  async deleteBoard(boardId: string): Promise<void> {
    await this.boardModel.findByIdAndDelete(boardId);
  }
}
