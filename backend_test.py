import requests
import sys
from datetime import datetime, timedelta
import json

class TaskVisionAPITester:
    def __init__(self, base_url="https://taskvision-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.employee_token = None
        self.admin_user_id = None
        self.employee_user_id = None
        self.test_task_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_registration(self):
        """Test admin user registration"""
        admin_data = {
            "email": "admin@test.com",
            "password": "password123",
            "name": "Test Admin",
            "role": "admin"
        }
        
        success, response = self.run_test(
            "Admin Registration",
            "POST",
            "auth/register",
            200,
            data=admin_data
        )
        
        if success and 'token' in response:
            self.admin_token = response['token']
            self.admin_user_id = response['user']['id']
            print(f"   Admin ID: {self.admin_user_id}")
            return True
        return False

    def test_employee_registration(self):
        """Test employee user registration"""
        employee_data = {
            "email": "employee@test.com",
            "password": "password123",
            "name": "Test Employee",
            "role": "employee"
        }
        
        success, response = self.run_test(
            "Employee Registration",
            "POST",
            "auth/register",
            200,
            data=employee_data
        )
        
        if success and 'token' in response:
            self.employee_token = response['token']
            self.employee_user_id = response['user']['id']
            print(f"   Employee ID: {self.employee_user_id}")
            return True
        return False

    def test_admin_login(self):
        """Test admin login"""
        login_data = {
            "email": "admin@test.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.admin_token = response['token']
            return True
        return False

    def test_employee_login(self):
        """Test employee login"""
        login_data = {
            "email": "employee@test.com",
            "password": "password123"
        }
        
        success, response = self.run_test(
            "Employee Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.employee_token = response['token']
            return True
        return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        login_data = {
            "email": "invalid@test.com",
            "password": "wrongpassword"
        }
        
        success, _ = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data=login_data
        )
        return success

    def test_get_me_admin(self):
        """Test getting current admin user"""
        success, response = self.run_test(
            "Get Current Admin User",
            "GET",
            "auth/me",
            200,
            token=self.admin_token
        )
        
        if success and response.get('role') == 'admin':
            print(f"   Admin user: {response.get('name')} ({response.get('email')})")
            return True
        return False

    def test_get_me_employee(self):
        """Test getting current employee user"""
        success, response = self.run_test(
            "Get Current Employee User",
            "GET",
            "auth/me",
            200,
            token=self.employee_token
        )
        
        if success and response.get('role') == 'employee':
            print(f"   Employee user: {response.get('name')} ({response.get('email')})")
            return True
        return False

    def test_create_task_admin(self):
        """Test task creation by admin"""
        due_date = (datetime.now() + timedelta(days=7)).isoformat()
        task_data = {
            "title": "Test Task",
            "description": "This is a test task for API testing",
            "priority": "high",
            "assigned_to": self.employee_user_id,
            "due_date": due_date,
            "estimated_hours": 8.0
        }
        
        success, response = self.run_test(
            "Create Task (Admin)",
            "POST",
            "tasks",
            200,
            data=task_data,
            token=self.admin_token
        )
        
        if success and 'id' in response:
            self.test_task_id = response['id']
            print(f"   Task ID: {self.test_task_id}")
            return True
        return False

    def test_create_task_employee_forbidden(self):
        """Test task creation by employee (should fail)"""
        task_data = {
            "title": "Unauthorized Task",
            "description": "This should fail",
            "priority": "low"
        }
        
        success, _ = self.run_test(
            "Create Task (Employee - Should Fail)",
            "POST",
            "tasks",
            403,
            data=task_data,
            token=self.employee_token
        )
        return success

    def test_get_all_tasks_admin(self):
        """Test getting all tasks as admin"""
        success, response = self.run_test(
            "Get All Tasks (Admin)",
            "GET",
            "tasks",
            200,
            token=self.admin_token
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} tasks")
            return True
        return False

    def test_get_assigned_tasks_employee(self):
        """Test getting assigned tasks as employee"""
        success, response = self.run_test(
            "Get Assigned Tasks (Employee)",
            "GET",
            "tasks",
            200,
            token=self.employee_token
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} assigned tasks")
            return True
        return False

    def test_get_single_task(self):
        """Test getting a single task"""
        if not self.test_task_id:
            print("❌ No test task ID available")
            return False
            
        success, response = self.run_test(
            "Get Single Task",
            "GET",
            f"tasks/{self.test_task_id}",
            200,
            token=self.admin_token
        )
        
        if success and response.get('id') == self.test_task_id:
            print(f"   Task: {response.get('title')}")
            return True
        return False

    def test_update_task_status_employee(self):
        """Test updating task status as employee"""
        if not self.test_task_id:
            print("❌ No test task ID available")
            return False
            
        update_data = {
            "status": "in_progress",
            "actual_hours": 2.5
        }
        
        success, response = self.run_test(
            "Update Task Status (Employee)",
            "PUT",
            f"tasks/{self.test_task_id}",
            200,
            data=update_data,
            token=self.employee_token
        )
        
        if success and response.get('status') == 'in_progress':
            print(f"   Updated status to: {response.get('status')}")
            return True
        return False

    def test_update_task_admin(self):
        """Test updating task as admin"""
        if not self.test_task_id:
            print("❌ No test task ID available")
            return False
            
        update_data = {
            "title": "Updated Test Task",
            "priority": "medium"
        }
        
        success, response = self.run_test(
            "Update Task (Admin)",
            "PUT",
            f"tasks/{self.test_task_id}",
            200,
            data=update_data,
            token=self.admin_token
        )
        
        if success and response.get('title') == 'Updated Test Task':
            print(f"   Updated title to: {response.get('title')}")
            return True
        return False

    def test_get_employees_admin(self):
        """Test getting employees list as admin"""
        success, response = self.run_test(
            "Get Employees (Admin)",
            "GET",
            "employees",
            200,
            token=self.admin_token
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} employees")
            return True
        return False

    def test_get_employees_employee_forbidden(self):
        """Test getting employees list as employee (should fail)"""
        success, _ = self.run_test(
            "Get Employees (Employee - Should Fail)",
            "GET",
            "employees",
            403,
            token=self.employee_token
        )
        return success

    def test_dashboard_stats_admin(self):
        """Test getting dashboard stats as admin"""
        success, response = self.run_test(
            "Dashboard Stats (Admin)",
            "GET",
            "dashboard/stats",
            200,
            token=self.admin_token
        )
        
        if success and 'total_tasks' in response:
            print(f"   Stats: {response}")
            return True
        return False

    def test_dashboard_stats_employee(self):
        """Test getting dashboard stats as employee"""
        success, response = self.run_test(
            "Dashboard Stats (Employee)",
            "GET",
            "dashboard/stats",
            200,
            token=self.employee_token
        )
        
        if success and 'total_tasks' in response:
            print(f"   Employee Stats: {response}")
            return True
        return False

    def test_delete_task_admin(self):
        """Test deleting task as admin"""
        if not self.test_task_id:
            print("❌ No test task ID available")
            return False
            
        success, response = self.run_test(
            "Delete Task (Admin)",
            "DELETE",
            f"tasks/{self.test_task_id}",
            200,
            token=self.admin_token
        )
        
        if success and response.get('message'):
            print(f"   {response.get('message')}")
            return True
        return False

    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        success, _ = self.run_test(
            "Unauthorized Access",
            "GET",
            "auth/me",
            401
        )
        return success

def main():
    print("🚀 Starting Task Vision API Tests")
    print("=" * 50)
    
    tester = TaskVisionAPITester()
    
    # Authentication Tests
    print("\n📋 AUTHENTICATION TESTS")
    print("-" * 30)
    
    if not tester.test_admin_registration():
        print("❌ Admin registration failed, trying login...")
        if not tester.test_admin_login():
            print("❌ Admin login also failed, stopping tests")
            return 1
    
    if not tester.test_employee_registration():
        print("❌ Employee registration failed, trying login...")
        if not tester.test_employee_login():
            print("❌ Employee login also failed, stopping tests")
            return 1
    
    tester.test_invalid_login()
    tester.test_get_me_admin()
    tester.test_get_me_employee()
    tester.test_unauthorized_access()
    
    # Task Management Tests
    print("\n📋 TASK MANAGEMENT TESTS")
    print("-" * 30)
    
    tester.test_create_task_admin()
    tester.test_create_task_employee_forbidden()
    tester.test_get_all_tasks_admin()
    tester.test_get_assigned_tasks_employee()
    tester.test_get_single_task()
    tester.test_update_task_status_employee()
    tester.test_update_task_admin()
    
    # User Management Tests
    print("\n👥 USER MANAGEMENT TESTS")
    print("-" * 30)
    
    tester.test_get_employees_admin()
    tester.test_get_employees_employee_forbidden()
    
    # Dashboard Tests
    print("\n📊 DASHBOARD TESTS")
    print("-" * 30)
    
    tester.test_dashboard_stats_admin()
    tester.test_dashboard_stats_employee()
    
    # Cleanup
    print("\n🧹 CLEANUP TESTS")
    print("-" * 30)
    
    tester.test_delete_task_admin()
    
    # Final Results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        failed_tests = tester.tests_run - tester.tests_passed
        print(f"❌ {failed_tests} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())