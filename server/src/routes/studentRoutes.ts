import { Router } from 'express';
import { requireAuth, requireStaff } from '../middleware/authMiddleware.js';
import {
  getStudents,
  getStudentDetail,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkDeleteStudents,
} from '../controllers/studentController.js';

const router = Router();

router.use(requireAuth);

// All endpoints require at least STAFF role (ADMIN + STAFF are both allowed)
// Scope enforcement (STAFF sees only assigned students) is done in controller/service
router.get('/students', requireStaff, getStudents);
router.get('/students/:studentId', requireStaff, getStudentDetail);
router.post('/students', requireStaff, createStudent);
router.post('/students/bulk-delete', requireStaff, bulkDeleteStudents);
router.patch('/students/:studentId', requireStaff, updateStudent);
router.delete('/students/:studentId', requireStaff, deleteStudent);

export default router;

