"""
api/billing.py
Flutterwave payment integration.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
import httpx

from api.auth import get_current_user, get_supabase_admin
from config import get_settings

settings = get_settings()
router   = APIRouter()

FLW_BASE  = "https://api.flutterwave.com/v3"
FLW_PLANS = {
    "pro":  {"name": "MentorAI Pro",  "amount": settings.pro_monthly_ngn,  "currency": "NGN"},
    "team": {"name": "MentorAI Team", "amount": settings.team_monthly_ngn, "currency": "NGN"},
}


class InitPaymentRequest(BaseModel):
    plan:         str   # "pro" | "team"
    redirect_url: str   # frontend URL to return to after payment


@router.post("/init")
async def init_payment(req: InitPaymentRequest, user=Depends(get_current_user)):
    """
    Initialise a Flutterwave payment link.
    Frontend redirects user to the returned payment_link.
    """
    if req.plan not in FLW_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")

    plan   = FLW_PLANS[req.plan]
    tx_ref = f"mentorai_{user.id[:8]}_{uuid.uuid4().hex[:8]}"

    payload = {
        "tx_ref":       tx_ref,
        "amount":       plan["amount"],
        "currency":     plan["currency"],
        "redirect_url": req.redirect_url,
        "customer": {
            "email": user.email,
            "name":  user.email.split("@")[0],
        },
        "customizations": {
            "title":       "MentorAI",
            "description": f"{plan['name']} — Monthly Subscription",
            "logo":        "https://mentorai.app/logo.png",
        },
        "meta": {
            "user_id": user.id,
            "plan":    req.plan,
            "tx_ref":  tx_ref,
        },
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(
                f"{FLW_BASE}/payments",
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.flutterwave_secret_key}",
                    "Content-Type":  "application/json",
                },
            )
        except httpx.ConnectTimeout:
            raise HTTPException(status_code=504, detail="Could not reach Flutterwave. Please try again.")
        except httpx.ReadTimeout:
            raise HTTPException(status_code=504, detail="Flutterwave took too long to respond. Please try again.")

    data = resp.json()
    print(f"Flutterwave response: {data}")  # log full response for debugging
    if data.get("status") != "success":
        raise HTTPException(
            status_code=502,
            detail=f"Flutterwave error: {data.get('message', 'Unknown error')}"
        )

    # store pending transaction
    sb = get_supabase_admin()
    sb.table("subscriptions").upsert({
        "user_id": user.id,
        "plan":    req.plan,
        "status":  "pending",
        "tx_ref":  tx_ref,
    }, on_conflict="user_id").execute()

    return {"payment_link": data["data"]["link"], "tx_ref": tx_ref}


@router.get("/verify")
async def verify_payment(
    transaction_id: str,
    tx_ref: str,
    status: str,
    user=Depends(get_current_user),
):
    """
    Verify payment after Flutterwave redirect.
    Flutterwave appends ?transaction_id=&tx_ref=&status= to redirect_url.
    """
    if status != "successful":
        raise HTTPException(status_code=400, detail=f"Payment status: {status}")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FLW_BASE}/transactions/{transaction_id}/verify",
            headers={"Authorization": f"Bearer {settings.flutterwave_secret_key}"},
            timeout=15,
        )

    data = resp.json()
    if data.get("status") != "success":
        raise HTTPException(status_code=400, detail="Payment verification failed")

    tx   = data["data"]
    meta = tx.get("meta", {})

    if meta.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="Transaction mismatch")

    if tx["status"] == "successful":
        plan = meta.get("plan", "pro")
        _activate_subscription(user.id, plan, tx_ref)
        return {"status": "active", "plan": plan}

    return {"status": tx["status"]}


@router.post("/webhook")
async def flutterwave_webhook(request: Request):
    """Flutterwave webhook — activates subscription on successful payment."""
    body      = await request.body()
    signature = request.headers.get("verif-hash", "")

    if settings.flutterwave_webhook_secret:
        if signature != settings.flutterwave_webhook_secret:
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    import json
    event = json.loads(body)

    if event.get("event") == "charge.completed":
        tx   = event.get("data", {})
        meta = tx.get("meta", {})
        if tx.get("status") == "successful" and meta.get("user_id"):
            _activate_subscription(
                meta["user_id"],
                meta.get("plan", "pro"),
                tx.get("tx_ref", ""),
            )

    return {"received": True}


def _activate_subscription(user_id: str, plan: str, tx_ref: str):
    from datetime import datetime, timedelta, timezone
    try:
        sb      = get_supabase_admin()
        expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        sb.table("subscriptions").upsert({
            "user_id":            user_id,
            "plan":               plan,
            "status":             "active",
            "tx_ref":             tx_ref,
            "current_period_end": expires,
        }, on_conflict="user_id").execute()
    except Exception as e:
        print(f"Failed to activate subscription: {e}")


@router.get("/status")
async def billing_status(user=Depends(get_current_user)):
    sb = get_supabase_admin()
    r  = sb.table("subscriptions").select("*")            .eq("user_id", user.id)            .order("created_at", desc=True)            .limit(1).execute()
    if not r.data:
        return {"plan": "free", "status": "none"}
    return r.data[0]


@router.post("/cancel")
async def cancel_subscription(user=Depends(get_current_user)):
    """Cancel the user's active subscription."""
    sb = get_supabase_admin()
    r  = sb.table("subscriptions").select("id,status")            .eq("user_id", user.id).execute()
    if not r.data or r.data[0]["status"] != "active":
        raise HTTPException(status_code=400, detail="No active subscription to cancel")

    sb.table("subscriptions").update({
        "status": "cancelled",
    }).eq("user_id", user.id).execute()

    return {"status": "cancelled"}
