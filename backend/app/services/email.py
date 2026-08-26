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

    def _send():
        try:
            # Connect to Gmail SMTP server
            server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=5)
            server.starttls() # Secure the connection
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, msg.as_string())
            server.quit()
            print(f"📩 [EMAIL SENT] OTP successfully sent to {to_email}")
        except Exception as e:
            print(f"❌ [EMAIL ERROR] Failed to send email to {to_email}: {e}")

    import threading
    threading.Thread(target=_send, daemon=True).start()


def send_manager_request_notification(employee_name: str, request_type: str, date_of_request: str, review_link: str):
    """
    Sends an instant notification email to the project manager(s) when a new request is submitted.
    Loads recipients from settings.MANAGER_NOTIF_EMAILS.
    """
    # If no credentials are provided, fallback to simulation mode
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        print(f"\n[EMAIL SIMULATION] New request submitted by {employee_name} ({request_type}) on {date_of_request}. Link: {review_link}")
        return

    # Parse recipients
    recipients = [r.strip() for r in settings.MANAGER_NOTIF_EMAILS.split(",") if r.strip()]
    if not recipients:
        recipients = [settings.SMTP_USERNAME]

    sender_email = settings.SMTP_USERNAME
    sender_password = settings.SMTP_PASSWORD

    msg = MIMEMultipart("alternative")
    msg['Subject'] = f"🔔 New Request Alert: {employee_name} - {request_type}"
    msg['From'] = f"XQ Pharma HR System <{sender_email}>"
    msg['To'] = ", ".join(recipients)

    text = (
        f"Dear Manager,\n\n"
        f"A new request has been submitted in the HR system and is pending your review:\n\n"
        f"- Employee Name: {employee_name}\n"
        f"- Request Type: {request_type}\n"
        f"- Date of Request: {date_of_request}\n"
        f"- Link to Review: {review_link}\n\n"
        f"Regards,\n"
        f"XQ Pharma HR System"
    )

    html = f"""\
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; direction: ltr; text-align: left;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
          <!-- Header -->
          <div style="background-color: #002749; padding: 20px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">XQ Pharma HR System</h2>
            <span style="font-size: 12px; opacity: 0.8; display: block; margin-top: 5px;">Instant Manager Alert System</span>
          </div>
          
          <!-- Content -->
          <div style="padding: 30px; background-color: #ffffff;">
            <p style="font-size: 16px; margin-top: 0;">Dear Manager,</p>
            <p style="font-size: 15px;">A new request has been submitted and requires your immediate attention and action:</p>
            
            <div style="background-color: #f7fafc; border-left: 4px solid #4f46e5; padding: 15px 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; width: 140px; font-size: 14px; color: #4a5568;">Employee Name:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #1a202c;">{employee_name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; font-size: 14px; color: #4a5568;">Request Type:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #1a202c;">
                    <span style="background-color: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 12px;">{request_type}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; font-size: 14px; color: #4a5568;">Request Date:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #1a202c;">{date_of_request}</td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0 20px 0;">
              <a href="{review_link}" style="background: linear-gradient(135deg, #4f46e5, #3730a3); color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3);">
                Review & Respond
              </a>
            </div>
          
            <p style="font-size: 12px; color: #718096; text-align: center; margin-top: 30px; border-top: 1px solid #edf2f7; padding-top: 15px;">
              Please do not reply directly to this email. You can approve or reject this request inside the XQ Pharma HR Portal.
            </p>
          </div>
        </div>
      </body>
    </html>
    """

    part1 = MIMEText(text, 'plain')
    part2 = MIMEText(html, 'html')

    msg.attach(part1)
    msg.attach(part2)

    def _send():
        try:
            server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=5)
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, recipients, msg.as_string())
            server.quit()
            print(f"📩 [EMAIL ALERT SENT] Request alert successfully sent to: {', '.join(recipients)}")
        except Exception as e:
            print(f"❌ [EMAIL ALERT ERROR] Failed to send request alert to {', '.join(recipients)}: {e}")

    import threading
    threading.Thread(target=_send, daemon=True).start()

