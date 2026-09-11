const AuthService = require('../../src/services/AuthService');
const { ConflictError, UnauthorizedError } = require('../../src/utils/ApiError');

describe('AuthService', () => {
  let mockUserModel;
  let authService;

  beforeEach(() => {
    mockUserModel = {
      findOne: jest.fn(),
      create: jest.fn(),
    };
    authService = new AuthService({
      userModel: mockUserModel,
      jwtSecret: 'test-secret',
      jwtExpiresIn: '1h',
    });
  });

  describe('register', () => {
    it('creates a user and returns a signed token when the email is new', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue({ _id: 'user123', name: 'Ada', email: 'ada@example.com' });

      const result = await authService.register({ name: 'Ada', email: 'ada@example.com', password: 'password123' });

      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'ada@example.com' });
      expect(mockUserModel.create).toHaveBeenCalledWith({
        name: 'Ada', email: 'ada@example.com', password: 'password123',
      });
      expect(result.user._id).toBe('user123');
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.')).toHaveLength(3); // looks like a JWT
    });

    it('throws ConflictError when the email is already registered', async () => {
      mockUserModel.findOne.mockResolvedValue({ _id: 'existing' });

      await expect(
        authService.register({ name: 'Ada', email: 'ada@example.com', password: 'password123' })
      ).rejects.toThrow(ConflictError);
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('lowercases the email before checking for an existing account', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue({ _id: 'u1' });

      await authService.register({ name: 'Ada', email: 'ADA@Example.com', password: 'password123' });

      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'ada@example.com' });
    });
  });

  describe('login', () => {
    it('returns a token when credentials are correct', async () => {
      const fakeUser = {
        _id: 'user123',
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });

      const result = await authService.login({ email: 'ada@example.com', password: 'correct-password' });

      expect(fakeUser.comparePassword).toHaveBeenCalledWith('correct-password');
      expect(typeof result.token).toBe('string');
    });

    it('throws UnauthorizedError when the user does not exist', async () => {
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await expect(
        authService.login({ email: 'ghost@example.com', password: 'whatever' })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError when the password is wrong', async () => {
      const fakeUser = { _id: 'user123', comparePassword: jest.fn().mockResolvedValue(false) };
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });

      await expect(
        authService.login({ email: 'ada@example.com', password: 'wrong-password' })
      ).rejects.toThrow(UnauthorizedError);
    });

    it('never reveals whether the failure was the email or the password', async () => {
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
      let noUserError;
      try {
        await authService.login({ email: 'ghost@example.com', password: 'x' });
      } catch (e) {
        noUserError = e;
      }

      const fakeUser = { _id: 'u1', comparePassword: jest.fn().mockResolvedValue(false) };
      mockUserModel.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(fakeUser) });
      let wrongPasswordError;
      try {
        await authService.login({ email: 'ada@example.com', password: 'wrong' });
      } catch (e) {
        wrongPasswordError = e;
      }

      expect(noUserError.message).toBe(wrongPasswordError.message);
      expect(noUserError.statusCode).toBe(wrongPasswordError.statusCode);
    });
  });

  describe('verifyToken', () => {
    it('round-trips a token issued by register()', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue({ _id: 'user123' });

      const { token } = await authService.register({ name: 'Ada', email: 'a@b.com', password: 'password123' });
      const payload = authService.verifyToken(token);

      expect(payload.sub).toBe('user123');
    });

    it('throws on a tampered token', () => {
      expect(() => authService.verifyToken('not-a-real-token')).toThrow();
    });
  });
});
