
const { Test } = require('@nestjs/testing');
const { AttendanceService } = require('./dist/modules/attendance/attendance.service');
const { TypeOrmModule, getRepositoryToken } = require('@nestjs/typeorm');
const { Attendance } = require('./dist/modules/attendance/attendance.entity');
const { EmployeeService } = require('./dist/modules/employees/employee.service');
const { LeavesService } = require('./dist/modules/leaves/leaves.service');

// Mock implementation or real one?
// Easier to just check for syntax by requiring it.
try {
    console.log('Testing import of AttendanceService...');
    require('./dist/modules/attendance/attendance.service');
    console.log('Import successful. No syntax errors in compiled JS.');
} catch (e) {
    console.error('Import failed:', e);
}
