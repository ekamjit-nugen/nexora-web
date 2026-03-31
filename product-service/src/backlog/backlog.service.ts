import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IBacklog, IBacklogItem, ISprint } from './backlog.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BacklogService {
  constructor(@InjectModel('Backlog') private backlogModel: Model<IBacklog>) {}

  /**
   * Get or create backlog for product
   */
  async getBacklog(productId: string): Promise<IBacklog> {
    let backlog = await this.backlogModel.findOne({ productId });

    if (!backlog) {
      backlog = new this.backlogModel({
        productId,
        items: [],
        sprints: [],
      });
      await backlog.save();
    }

    return backlog;
  }

  /**
   * Add item to backlog
   */
  async addItem(productId: string, item: Omit<IBacklogItem, 'id' | 'order'>): Promise<IBacklog> {
    const backlog = await this.getBacklog(productId);

    const newItem: IBacklogItem = {
      id: uuidv4(),
      productId,
      order: backlog.items.length,
      ...item,
    };

    backlog.items.push(newItem);
    return backlog.save();
  }

  /**
   * Update backlog item
   */
  async updateItem(productId: string, itemId: string, updates: Partial<IBacklogItem>): Promise<IBacklog> {
    const backlog = await this.getBacklog(productId);
    const item = backlog.items.find(i => i.id === itemId);

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    Object.assign(item, updates);
    return backlog.save();
  }

  /**
   * Prioritize items
   */
  async prioritizeItems(productId: string, itemIds: string[]): Promise<IBacklog> {
    const backlog = await this.getBacklog(productId);

    // Reorder items by provided IDs
    const itemMap = new Map(backlog.items.map((item, i) => [item.id, { ...item, order: i }]));
    backlog.items = itemIds
      .map((id, i) => {
        const item = itemMap.get(id);
        if (item) {
          item.order = i;
          return item;
        }
        return null;
      })
      .filter(Boolean);

    return backlog.save();
  }

  /**
   * Move item to sprint
   */
  async moveItemToSprint(productId: string, itemId: string, sprintId: string): Promise<IBacklog> {
    const backlog = await this.getBacklog(productId);
    const item = backlog.items.find(i => i.id === itemId);
    const sprint = backlog.sprints.find(s => s.id === sprintId);

    if (!item || !sprint) {
      throw new NotFoundException('Item or sprint not found');
    }

    item.sprint = sprintId;
    item.status = 'todo';

    if (!sprint.items.includes(itemId)) {
      sprint.items.push(itemId);
    }

    return backlog.save();
  }

  /**
   * Create sprint
   */
  async createSprint(
    productId: string,
    sprint: Omit<ISprint, 'id' | 'items'>,
  ): Promise<IBacklog> {
    const backlog = await this.getBacklog(productId);

    const newSprint: ISprint = {
      id: uuidv4(),
      items: [],
      ...sprint,
    };

    backlog.sprints.push(newSprint);
    return backlog.save();
  }

  /**
   * Update sprint
   */
  async updateSprint(productId: string, sprintId: string, updates: Partial<ISprint>): Promise<IBacklog> {
    const backlog = await this.getBacklog(productId);
    const sprint = backlog.sprints.find(s => s.id === sprintId);

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    Object.assign(sprint, updates);
    return backlog.save();
  }

  /**
   * Get sprint items
   */
  async getSprintItems(productId: string, sprintId: string): Promise<IBacklogItem[]> {
    const backlog = await this.getBacklog(productId);
    const sprint = backlog.sprints.find(s => s.id === sprintId);

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    return backlog.items.filter(i => sprint.items.includes(i.id));
  }

  /**
   * Get sprint capacity
   */
  async getSprintCapacity(productId: string, sprintId: string): Promise<any> {
    const backlog = await this.getBacklog(productId);
    const sprint = backlog.sprints.find(s => s.id === sprintId);

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const items = backlog.items.filter(i => sprint.items.includes(i.id));
    const totalPoints = items.reduce((sum, i) => sum + (i.storyPoints || 0), 0);

    return {
      sprintId: sprint.id,
      name: sprint.name,
      capacity: sprint.capacity,
      allocated: totalPoints,
      remaining: sprint.capacity - totalPoints,
      utilization: ((totalPoints / sprint.capacity) * 100).toFixed(2),
      itemCount: items.length,
    };
  }

  /**
   * Get backlog stats
   */
  async getBacklogStats(productId: string): Promise<any> {
    const backlog = await this.getBacklog(productId);

    const stats = {
      totalItems: backlog.items.length,
      priorityBreakdown: {
        critical: backlog.items.filter(i => i.priority === 'critical').length,
        high: backlog.items.filter(i => i.priority === 'high').length,
        medium: backlog.items.filter(i => i.priority === 'medium').length,
        low: backlog.items.filter(i => i.priority === 'low').length,
      },
      statusBreakdown: {
        todo: backlog.items.filter(i => i.status === 'todo').length,
        inProgress: backlog.items.filter(i => i.status === 'inProgress').length,
        review: backlog.items.filter(i => i.status === 'review').length,
        done: backlog.items.filter(i => i.status === 'done').length,
      },
      totalStoryPoints: backlog.items.reduce((sum, i) => sum + (i.storyPoints || 0), 0),
      completedStoryPoints: backlog.items
        .filter(i => i.status === 'done')
        .reduce((sum, i) => sum + (i.storyPoints || 0), 0),
      totalSprints: backlog.sprints.length,
      activeSprints: backlog.sprints.filter(s => s.status === 'active').length,
    };

    return stats;
  }

  /**
   * Refine backlog item
   */
  async refineItem(
    productId: string,
    itemId: string,
    refinement: {
      description: string;
      acceptanceCriteria: string[];
      storyPoints: number;
    },
  ): Promise<IBacklog> {
    const backlog = await this.getBacklog(productId);
    const item = backlog.items.find(i => i.id === itemId);

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    item.description = refinement.description;
    item.storyPoints = refinement.storyPoints;

    return backlog.save();
  }

  /**
   * Delete backlog item
   */
  async deleteItem(productId: string, itemId: string): Promise<IBacklog> {
    const backlog = await this.getBacklog(productId);

    backlog.items = backlog.items.filter(i => i.id !== itemId);

    // Remove from sprints
    backlog.sprints.forEach(sprint => {
      sprint.items = sprint.items.filter(id => id !== itemId);
    });

    return backlog.save();
  }

  /**
   * Delete sprint
   */
  async deleteSprint(productId: string, sprintId: string): Promise<IBacklog> {
    const backlog = await this.getBacklog(productId);

    backlog.sprints = backlog.sprints.filter(s => s.id !== sprintId);

    return backlog.save();
  }
}
