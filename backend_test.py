import requests
import sys
import json
from datetime import datetime

class TempMailAPITester:
    def __init__(self, base_url="https://securecomm-13.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.generated_code = None
        self.temp_email = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "endpoint": endpoint
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e),
                "endpoint": endpoint
            })
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "admin/login",
            200,
            data={"username": "admin", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def test_admin_stats(self):
        """Test admin stats endpoint"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        success, response = self.run_test(
            "Admin Stats",
            "GET",
            "admin/stats",
            200,
            headers=headers
        )
        if success:
            print(f"   Stats: {response}")
        return success

    def test_generate_access_code(self):
        """Test generating access code"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        success, response = self.run_test(
            "Generate Access Code",
            "POST",
            "admin/generate-code",
            200,
            data={"expiry_hours": 12},
            headers=headers
        )
        if success and 'code' in response:
            self.generated_code = response['code']
            print(f"   Generated code: {self.generated_code}")
            return True
        return False

    def test_get_admin_codes(self):
        """Test getting all admin codes"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        success, response = self.run_test(
            "Get Admin Codes",
            "GET",
            "admin/codes",
            200,
            headers=headers
        )
        if success:
            print(f"   Found {len(response)} codes")
        return success

    def test_verify_code_invalid(self):
        """Test verifying invalid code"""
        success, response = self.run_test(
            "Verify Invalid Code",
            "POST",
            "verify-code",
            400,
            data={"code": "INVALID123"}
        )
        return success

    def test_verify_code_valid(self):
        """Test verifying valid code"""
        if not self.generated_code:
            print("❌ No generated code available")
            return False
            
        success, response = self.run_test(
            "Verify Valid Code",
            "POST",
            "verify-code",
            200,
            data={"code": self.generated_code}
        )
        if success and 'token' in response:
            self.user_token = response['token']
            self.temp_email = response.get('email_address')
            print(f"   User token obtained: {self.user_token[:20]}...")
            print(f"   Temp email: {self.temp_email}")
            return True
        return False

    def test_generate_new_email(self):
        """Test generating new email"""
        if not self.user_token:
            print("❌ No user token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.user_token}'}
        success, response = self.run_test(
            "Generate New Email",
            "POST",
            "email/generate",
            200,
            headers=headers
        )
        if success:
            print(f"   New email: {response.get('email_address')}")
        return success

    def test_get_user_emails(self):
        """Test getting user emails"""
        if not self.user_token:
            print("❌ No user token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.user_token}'}
        success, response = self.run_test(
            "Get User Emails",
            "GET",
            "emails",
            200,
            headers=headers
        )
        if success:
            print(f"   Found {len(response)} emails")
        return success

    def test_get_messages(self):
        """Test getting messages"""
        if not self.user_token:
            print("❌ No user token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.user_token}'}
        success, response = self.run_test(
            "Get Messages",
            "GET",
            "messages",
            200,
            headers=headers
        )
        if success:
            print(f"   Found {len(response)} messages")
        return success

    def test_send_mock_email(self):
        """Test sending mock email"""
        if not self.temp_email:
            print("❌ No temp email available")
            return False
            
        success, response = self.run_test(
            "Send Mock Email",
            "POST",
            "mock-email",
            200,
            data={
                "to_email": self.temp_email,
                "from_email": "test@example.com",
                "subject": "Test Email",
                "body": "This is a test email message."
            }
        )
        if success:
            print(f"   Mock email sent to: {self.temp_email}")
        return success

    def test_get_messages_after_mock(self):
        """Test getting messages after sending mock email"""
        if not self.user_token:
            print("❌ No user token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.user_token}'}
        success, response = self.run_test(
            "Get Messages After Mock",
            "GET",
            "messages",
            200,
            headers=headers
        )
        if success:
            print(f"   Found {len(response)} messages after mock email")
            if len(response) > 0:
                print(f"   Latest message: {response[0].get('subject', 'No subject')}")
        return success

    def test_api_root(self):
        """Test API root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET",
            "",
            200
        )
        if success:
            print(f"   API Response: {response}")
        return success

def main():
    print("🚀 Starting TempMail API Tests...")
    print("=" * 50)
    
    tester = TempMailAPITester()
    
    # Test sequence
    tests = [
        ("API Root", tester.test_api_root),
        ("Admin Login", tester.test_admin_login),
        ("Admin Stats", tester.test_admin_stats),
        ("Generate Access Code", tester.test_generate_access_code),
        ("Get Admin Codes", tester.test_get_admin_codes),
        ("Verify Invalid Code", tester.test_verify_code_invalid),
        ("Verify Valid Code", tester.test_verify_code_valid),
        ("Generate New Email", tester.test_generate_new_email),
        ("Get User Emails", tester.test_get_user_emails),
        ("Get Messages (Empty)", tester.test_get_messages),
        ("Send Mock Email", tester.test_send_mock_email),
        ("Get Messages (After Mock)", tester.test_get_messages_after_mock),
    ]
    
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            tester.failed_tests.append({
                "test": test_name,
                "error": str(e)
            })

    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.failed_tests:
        print("\n❌ Failed Tests:")
        for failure in tester.failed_tests:
            error_msg = failure.get('error', f"Expected {failure.get('expected')}, got {failure.get('actual')}")
            print(f"   - {failure['test']}: {error_msg}")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"\n✅ Success Rate: {success_rate:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())