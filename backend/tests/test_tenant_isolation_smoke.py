import os
import time

import httpx


BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:8000/api").rstrip("/")
SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "admin@mail.com")
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "Admin@123")


def _login(client: httpx.Client, email: str, password: str) -> dict:
    last_exc = None
    for _ in range(15):
        try:
            res = client.post(
                f"{BASE_URL}/auth/login",
                json={"email": email, "password": password},
                timeout=30.0,
            )
            assert res.status_code == 200, res.text
            return res.json()
        except httpx.ConnectError as exc:
            last_exc = exc
            time.sleep(1)
    raise AssertionError(f"Could not reach API at {BASE_URL}: {last_exc}")


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_cross_tenant_manager_report_is_blocked():
    suffix = str(int(time.time()))

    with httpx.Client() as client:
        super_login = _login(client, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
        super_headers = _auth_headers(super_login["token"])

        t1_res = client.post(
            f"{BASE_URL}/admins/tenants",
            headers=super_headers,
            json={
                "name": f"Smoke Tenant A {suffix}",
                "admin_full_name": "Smoke Admin A",
                "admin_email": f"smoke.a.{suffix}@mail.com",
            },
            timeout=30.0,
        )
        assert t1_res.status_code == 200, t1_res.text
        t1 = t1_res.json()

        t2_res = client.post(
            f"{BASE_URL}/admins/tenants",
            headers=super_headers,
            json={
                "name": f"Smoke Tenant B {suffix}",
                "admin_full_name": "Smoke Admin B",
                "admin_email": f"smoke.b.{suffix}@mail.com",
            },
            timeout=30.0,
        )
        assert t2_res.status_code == 200, t2_res.text
        t2 = t2_res.json()

        school_res = client.post(
            f"{BASE_URL}/admins/schools",
            headers=super_headers,
            json={
                "tenant_id": t2["tenant"]["id"],
                "name": f"Smoke School B {suffix}",
                "address": "Tenant B Address",
            },
            timeout=30.0,
        )
        assert school_res.status_code == 200, school_res.text
        school = school_res.json()["school"]

        tenant1_admin = _login(
            client,
            t1["default_admin"]["email"],
            t1["default_admin"]["temporary_password"],
        )
        tenant1_headers = _auth_headers(tenant1_admin["token"])

        report_res = client.get(
            f"{BASE_URL}/managers/reports/students",
            headers=tenant1_headers,
            params={"school_id": school["id"], "period": "monthly"},
            timeout=30.0,
        )

        assert report_res.status_code == 403, (
            f"Expected 403 for cross-tenant report access, "
            f"got {report_res.status_code}: {report_res.text}"
        )


def test_cross_tenant_admin_deactivation_is_blocked():
    suffix = f"deact-{int(time.time())}"

    with httpx.Client() as client:
        super_login = _login(client, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
        super_headers = _auth_headers(super_login["token"])

        t1_res = client.post(
            f"{BASE_URL}/admins/tenants",
            headers=super_headers,
            json={
                "name": f"Smoke Deact Tenant A {suffix}",
                "admin_full_name": "Smoke Deact Admin A",
                "admin_email": f"smoke.deact.a.{suffix}@mail.com",
            },
            timeout=30.0,
        )
        assert t1_res.status_code == 200, t1_res.text
        t1 = t1_res.json()

        t2_res = client.post(
            f"{BASE_URL}/admins/tenants",
            headers=super_headers,
            json={
                "name": f"Smoke Deact Tenant B {suffix}",
                "admin_full_name": "Smoke Deact Admin B",
                "admin_email": f"smoke.deact.b.{suffix}@mail.com",
            },
            timeout=30.0,
        )
        assert t2_res.status_code == 200, t2_res.text
        t2 = t2_res.json()

        tenant1_admin = _login(
            client,
            t1["default_admin"]["email"],
            t1["default_admin"]["temporary_password"],
        )
        tenant1_headers = _auth_headers(tenant1_admin["token"])

        target_admin_id = t2["default_admin"]["id"]
        deactivate_res = client.delete(
            f"{BASE_URL}/admins/users/{target_admin_id}",
            headers=tenant1_headers,
            timeout=30.0,
        )

        assert deactivate_res.status_code == 403, (
            f"Expected 403 for cross-tenant deactivation, "
            f"got {deactivate_res.status_code}: {deactivate_res.text}"
        )


def test_tenant_admin_can_manage_users_across_tenant_schools_and_switch_school():
    suffix = f"switch-{int(time.time())}"

    with httpx.Client() as client:
        super_login = _login(client, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
        super_headers = _auth_headers(super_login["token"])

        tenant_res = client.post(
            f"{BASE_URL}/admins/tenants",
            headers=super_headers,
            json={
                "name": f"Smoke Switch Tenant {suffix}",
                "admin_full_name": "Smoke Switch Admin",
                "admin_email": f"smoke.switch.{suffix}@mail.com",
            },
            timeout=30.0,
        )
        assert tenant_res.status_code == 200, tenant_res.text
        tenant_payload = tenant_res.json()

        tenant_admin = _login(
            client,
            tenant_payload["default_admin"]["email"],
            tenant_payload["default_admin"]["temporary_password"],
        )
        tenant_headers = _auth_headers(tenant_admin["token"])

        school_a_res = client.post(
            f"{BASE_URL}/admins/schools",
            headers=tenant_headers,
            json={
                "name": f"Switch School A {suffix}",
                "address": "Address A",
            },
            timeout=30.0,
        )
        assert school_a_res.status_code == 200, school_a_res.text
        school_a_id = school_a_res.json()["school"]["id"]

        school_b_res = client.post(
            f"{BASE_URL}/admins/schools",
            headers=tenant_headers,
            json={
                "name": f"Switch School B {suffix}",
                "address": "Address B",
            },
            timeout=30.0,
        )
        assert school_b_res.status_code == 200, school_b_res.text
        school_b_id = school_b_res.json()["school"]["id"]

        manager_res = client.post(
            f"{BASE_URL}/admins/users",
            headers=tenant_headers,
            json={
                "email": f"mgr.switch.{suffix}@mail.com",
                "full_name": "Switch Manager",
                "role": "manager",
                "school_id": school_a_id,
            },
            timeout=30.0,
        )
        assert manager_res.status_code == 200, manager_res.text
        manager_user_id = manager_res.json()["user"]["id"]

        teacher_res = client.post(
            f"{BASE_URL}/admins/users",
            headers=tenant_headers,
            json={
                "email": f"teacher.switch.{suffix}@mail.com",
                "full_name": "Switch Teacher",
                "role": "teacher",
                "school_id": school_b_id,
            },
            timeout=30.0,
        )
        assert teacher_res.status_code == 200, teacher_res.text

        list_before_res = client.get(
            f"{BASE_URL}/admins/users",
            headers=tenant_headers,
            timeout=30.0,
        )
        assert list_before_res.status_code == 200, list_before_res.text
        list_before = list_before_res.json()

        manager_before = next((u for u in list_before if u["id"] == manager_user_id), None)
        teacher_in_list = next((u for u in list_before if u["id"] == teacher_res.json()["user"]["id"]), None)
        assert manager_before is not None, "Manager user should be visible in tenant-wide list"
        assert teacher_in_list is not None, "Teacher user should be visible in tenant-wide list"
        assert str(manager_before.get("school_id")) == str(school_a_id)

        switch_res = client.put(
            f"{BASE_URL}/admins/users/{manager_user_id}",
            headers=tenant_headers,
            json={"school_id": school_b_id},
            timeout=30.0,
        )
        assert switch_res.status_code == 200, switch_res.text

        list_after_res = client.get(
            f"{BASE_URL}/admins/users",
            headers=tenant_headers,
            timeout=30.0,
        )
        assert list_after_res.status_code == 200, list_after_res.text
        list_after = list_after_res.json()
        manager_after = next((u for u in list_after if u["id"] == manager_user_id), None)
        assert manager_after is not None
        assert str(manager_after.get("school_id")) == str(school_b_id)


def test_super_admin_can_hard_delete_any_user():
    suffix = f"hard-{int(time.time())}"

    with httpx.Client() as client:
        super_login = _login(client, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
        super_headers = _auth_headers(super_login["token"])

        tenant_res = client.post(
            f"{BASE_URL}/admins/tenants",
            headers=super_headers,
            json={
                "name": f"Smoke Hard Delete Tenant {suffix}",
                "admin_full_name": "Smoke Hard Delete Admin",
                "admin_email": f"smoke.hard.{suffix}@mail.com",
            },
            timeout=30.0,
        )
        assert tenant_res.status_code == 200, tenant_res.text
        tenant_payload = tenant_res.json()
        target_user_id = tenant_payload["default_admin"]["id"]

        hard_delete_res = client.delete(
            f"{BASE_URL}/admins/users/{target_user_id}/hard",
            headers=super_headers,
            timeout=30.0,
        )
        assert hard_delete_res.status_code == 200, hard_delete_res.text

        users_res = client.get(
            f"{BASE_URL}/admins/users",
            headers=super_headers,
            timeout=30.0,
        )
        assert users_res.status_code == 200, users_res.text
        users = users_res.json()

        deleted_user = next((u for u in users if u["id"] == target_user_id), None)
        assert deleted_user is None, "Hard-deleted user should not exist in users list"
