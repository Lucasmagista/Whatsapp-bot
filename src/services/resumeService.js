// Resume Service
const Resume = require('../models/Resume');
module.exports = {
  async uploadResume(userId, fileUrl) {
    return await Resume.create({ userId, fileUrl });
  },
  async getResumeById(id) {
    return await Resume.findByPk(id);
  }
};
