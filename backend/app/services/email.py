import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

def send_2fa_email(to_email: str, otp_code: str):
    """
    Sends the 2FA OTP code to the given email address using Gmail SMTP.
    Requires SMTP_USERNAME and SMTP_PASSWORD to be set in settings (.env).
    """
    # If no credentials are provided, fallback to simulation mode
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        print(f"\n[EMAIL SIMULATION] Would have sent {otp_code} to {to_email}")
        return

    sender_email = settings.SMTP_USERNAME
    sender_password = settings.SMTP_PASSWORD

    msg = MIMEMultipart("alternative")
    msg['Subject'] = "Your Login Verification Code (OTP) - XQ Pharma"
    msg['From'] = f"XQ Pharma HR System <{sender_email}>"
    msg['To'] = to_email

    # Email Body
    text = f"Hello,\n\nYour 2FA verification code is: {otp_code}\n\nThis code will expire shortly.\n\nRegards,\nXQ Pharma Team"
    
    html = f"""\
    <html>
      <body dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
        <h2 style="color: #002749;">نظام إدارة الموارد البشرية - XQ Pharma</h2>
        <p>مرحباً،</p>
        <p>رمز التحقق الثنائي (OTP) الخاص بك هو:</p>
        <h1 style="color: #D63A2F; letter-spacing: 4px;">{otp_code}</h1>
        <p>يرجى إدخال هذا الرمز للمتابعة. هذا الرمز صالح لفترة قصيرة فقط.</p>
        <hr style="border: none; border-top: 1px solid #ccc; margin-top: 20px;" />
        <p style="font-size: 12px; color: #888;">إذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة.</p>
      </body>
    </html>
    """

    part1 = MIMEText(text, 'plain')
    part2 = MIMEText(html, 'html')

    msg.attach(part1)
    msg.attach(part2)

    try:
        # Connect to Gmail SMTP server
        server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
        server.starttls() # Secure the connection
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, to_email, msg.as_string())
        server.quit()
        print(f"📩 [EMAIL SENT] OTP successfully sent to {to_email}")
    except Exception as e:
        print(f"❌ [EMAIL ERROR] Failed to send email to {to_email}: {e}")
