import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { AuthService } from '../../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { RequestOtpDto, VerifyOtpDto, RefreshTokenDto } from '../dto/auth.dto';

@injectable()
export class AuthController {
  constructor(@inject(AuthService) private authService: AuthService) { }

  /**
   * POST /api/auth/request-otp
   * Request OTP code to be sent via WhatsApp
   */
  requestOtp = asyncHandler(async (req: Request, res: Response) => {
    const dto: RequestOtpDto = req.body;
    const result = await this.authService.requestOtp(dto);

    res.json({
      success: true,
      data: result,
      message: 'Verification code sent to your WhatsApp',
    });
  });

  /**
   * POST /api/auth/verify-otp
   * Verify OTP code and get authentication tokens
   */
  verifyOtp = asyncHandler(async (req: Request, res: Response) => {
    const dto: VerifyOtpDto = req.body;
    const result = await this.authService.verifyOtp(dto);

    res.json({
      success: true,
      data: result,
      message: 'Login successful',
    });
  });

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken }: RefreshTokenDto = req.body;
    const result = await this.authService.refreshToken(refreshToken);

    res.json({
      success: true,
      data: result,
    });
  });

  /**
   * GET /api/auth/me
   * Get current user profile
   */
  getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await this.authService.getMe(req.user!.id);

    res.json({
      success: true,
      data: user,
    });
  });

  /**
   * POST /api/auth/logout
   * Logout (client-side token deletion)
   */
  logout = asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  });
}
