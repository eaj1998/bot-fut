import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { DashboardService, DASHBOARD_SERVICE_TOKEN } from '../../services/dashboard.service';

@injectable()
export class DashboardController {
    constructor(
        @inject(DASHBOARD_SERVICE_TOKEN) private readonly dashboardService: DashboardService
    ) { }

    /**
     * Obtém estatísticas completas do dashboard
     */
    getDashboard = async (req: Request, res: Response) => {
        try {
            const workspaceId = req.params.workspaceId;
            const dashboard = await this.dashboardService.getDashboardStats(workspaceId);
            res.json(dashboard);
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message || 'Erro ao obter dados do dashboard',
                statusCode: 500,
            });
        }
    };

    /**
     * Obtém apenas estatísticas
     */
    getStats = async (req: Request, res: Response) => {
        try {
            const workspaceId = req.params.workspaceId;
            const stats = await this.dashboardService.getStats(workspaceId);
            res.json(stats);
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message || 'Erro ao obter estatísticas',
                statusCode: 500,
            });
        }
    };
}
