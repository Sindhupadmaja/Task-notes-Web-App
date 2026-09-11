const TaskService = require('../../src/services/TaskService');
const { NotFoundError, ForbiddenError } = require('../../src/utils/ApiError');

describe('TaskService', () => {
  let mockTaskModel;
  let taskService;

  beforeEach(() => {
    mockTaskModel = {
      create: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      findById: jest.fn(),
    };
    taskService = new TaskService({ taskModel: mockTaskModel });
  });

  describe('create', () => {
    it('stamps the task with the owner id', async () => {
      mockTaskModel.create.mockResolvedValue({ _id: 't1', title: 'Write tests', owner: 'user123' });

      await taskService.create('user123', { title: 'Write tests' });

      expect(mockTaskModel.create).toHaveBeenCalledWith({ title: 'Write tests', owner: 'user123' });
    });
  });

  describe('list', () => {
    function mockQueryChain(items) {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(items),
      };
      return chain;
    }

    it('scopes the query to the owner', async () => {
      mockTaskModel.find.mockReturnValue(mockQueryChain([]));
      mockTaskModel.countDocuments.mockResolvedValue(0);

      await taskService.list('user123', {});

      expect(mockTaskModel.find).toHaveBeenCalledWith(expect.objectContaining({ owner: 'user123' }));
    });

    it('applies status and priority filters when provided', async () => {
      mockTaskModel.find.mockReturnValue(mockQueryChain([]));
      mockTaskModel.countDocuments.mockResolvedValue(0);

      await taskService.list('user123', { status: 'done', priority: 'high' });

      expect(mockTaskModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'user123', status: 'done', priority: 'high' })
      );
    });

    it('falls back to a safe sort field when given an unknown one', async () => {
      const chain = mockQueryChain([]);
      mockTaskModel.find.mockReturnValue(chain);
      mockTaskModel.countDocuments.mockResolvedValue(0);

      await taskService.list('user123', { sortBy: '$where' }); // attempted injection-ish input

      expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it('clamps limit to a maximum of 100', async () => {
      const chain = mockQueryChain([]);
      mockTaskModel.find.mockReturnValue(chain);
      mockTaskModel.countDocuments.mockResolvedValue(0);

      const result = await taskService.list('user123', { limit: 9999 });

      expect(chain.limit).toHaveBeenCalledWith(100);
      expect(result.pagination.limit).toBe(100);
    });

    it('computes totalPages correctly', async () => {
      mockTaskModel.find.mockReturnValue(mockQueryChain([]));
      mockTaskModel.countDocuments.mockResolvedValue(45);

      const result = await taskService.list('user123', { limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('ownership enforcement', () => {
    it('getById throws NotFoundError when the task does not exist', async () => {
      mockTaskModel.findById.mockResolvedValue(null);

      await expect(taskService.getById('user123', 'missing-id')).rejects.toThrow(NotFoundError);
    });

    it('getById throws ForbiddenError when the task belongs to someone else', async () => {
      mockTaskModel.findById.mockResolvedValue({ _id: 't1', owner: { toString: () => 'other-user' } });

      await expect(taskService.getById('user123', 't1')).rejects.toThrow(ForbiddenError);
    });

    it('getById succeeds when the task belongs to the requester', async () => {
      const fakeTask = { _id: 't1', owner: { toString: () => 'user123' } };
      mockTaskModel.findById.mockResolvedValue(fakeTask);

      const result = await taskService.getById('user123', 't1');
      expect(result).toBe(fakeTask);
    });

    it('update refuses to modify a task owned by someone else', async () => {
      mockTaskModel.findById.mockResolvedValue({ _id: 't1', owner: { toString: () => 'other-user' }, save: jest.fn() });

      await expect(taskService.update('user123', 't1', { title: 'hijacked' })).rejects.toThrow(ForbiddenError);
    });

    it('remove refuses to delete a task owned by someone else', async () => {
      mockTaskModel.findById.mockResolvedValue({
        _id: 't1', owner: { toString: () => 'other-user' }, deleteOne: jest.fn(),
      });

      await expect(taskService.remove('user123', 't1')).rejects.toThrow(ForbiddenError);
    });

    it('update applies changes and saves when ownership matches', async () => {
      const fakeTask = { _id: 't1', owner: { toString: () => 'user123' }, title: 'old', save: jest.fn().mockResolvedValue() };
      mockTaskModel.findById.mockResolvedValue(fakeTask);

      const result = await taskService.update('user123', 't1', { title: 'new title' });

      expect(fakeTask.save).toHaveBeenCalled();
      expect(result.title).toBe('new title');
    });
  });
});
