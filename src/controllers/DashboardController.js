const DashboardModel = require('../models/DashboardModel');

class DashboardController {
  static async getStats(req, res, next) {
    try {
      if (req.user.rol === 'Super Admin' || req.user.rol === 'Admin') {
        const stats = await DashboardModel.getAdminStats();
        return res.json({
          success: true,
          rol: req.user.rol,
          data: stats
        });
      }

      const userStats = await DashboardModel.getUserStats(req.user.id_usuario);
      res.json({
        success: true,
        rol: req.user.rol,
        data: userStats
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DashboardController;
