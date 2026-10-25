/**
 * Realistic sample mobile screens for immediate testing & evals
 */

// Helper to generate SVG data URIs
function createPhoneScreenSvg(title: string, subtitle: string, bodyText: string, buttons: Array<{ text: string; bg: string; color: string; isTarget?: boolean }>, isScam = false): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="640" viewBox="0 0 380 640">
    <rect width="380" height="640" rx="32" fill="${isScam ? '#FFF5F5' : '#F8FAFC'}"/>
    <!-- Phone status bar -->
    <rect width="380" height="36" fill="${isScam ? '#FEE2E2' : '#0F172A'}"/>
    <text x="24" y="22" fill="${isScam ? '#991B1B' : '#FFFFFF'}" font-size="12" font-family="sans-serif" font-weight="bold">9:41 AM</text>
    <text x="310" y="22" fill="${isScam ? '#991B1B' : '#FFFFFF'}" font-size="12" font-family="sans-serif">5G 98%</text>

    <!-- App header -->
    <rect y="36" width="380" height="54" fill="${isScam ? '#DC2626' : '#2563EB'}"/>
    <text x="20" y="70" fill="#FFFFFF" font-size="18" font-family="sans-serif" font-weight="bold">${title}</text>

    <!-- Card -->
    <rect x="20" y="110" width="340" height="420" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>

    <text x="40" y="150" fill="${isScam ? '#DC2626' : '#1E293B'}" font-size="18" font-family="sans-serif" font-weight="bold">${subtitle}</text>

    <foreignObject x="40" y="170" width="300" height="180">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:sans-serif;font-size:14px;color:#475569;line-height:1.5;">
        ${bodyText}
      </div>
    </foreignObject>

    <!-- Buttons -->
    ${buttons.map((b, idx) => {
      const btnY = 380 + (idx * 60);
      return `
        <g id="btn-${idx}">
          <rect x="40" y="${btnY}" width="300" height="48" rx="14" fill="${b.bg}" stroke="#CBD5E1" stroke-width="${b.isTarget ? '2' : '0'}"/>
          <text x="190" y="${btnY + 30}" fill="${b.color}" font-size="16" font-family="sans-serif" font-weight="bold" text-anchor="middle">${b.text}</text>
        </g>
      `;
    }).join('')}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface SampleScreen {
  id: string;
  name: string;
  badge: 'scam' | 'safe' | 'caution';
  description: string;
  dataUrl: string;
  ocrText: string;
  elements: Array<{ id: number; text: string; box: [number, number, number, number] }>;
}

export const SAMPLE_SCREENS: SampleScreen[] = [
  {
    id: 'upi-scam',
    name: 'Fake UPI Collect Request',
    badge: 'scam',
    description: 'Scammer requests ₹4,999 pretending you won a prize.',
    dataUrl: createPhoneScreenSvg(
      'Payment Request',
      'Collect Request: ₹4,999',
      `<p style="margin-bottom:8px;"><strong>From:</strong> Prize Distribution Hub</p>
       <p style="margin-bottom:8px;"><strong>Note:</strong> Enter UPI PIN to claim reward.</p>
       <p style="color:#DC2626;font-size:12px;"><strong>Warning:</strong> Authorize immediately to avoid cancellation.</p>`,
      [
        { text: 'Pay ₹4,999', bg: '#DC2626', color: '#FFFFFF' },
        { text: 'Decline Request', bg: '#F1F5F9', color: '#475569', isTarget: true }
      ],
      true
    ),
    ocrText: 'Payment Request Collect Request: ₹4,999 From Prize Distribution Hub Note: Enter UPI PIN to claim reward. Pay ₹4,999 Decline Request',
    elements: [
      { id: 1, text: 'Pay ₹4,999', box: [40, 380, 300, 48] },
      { id: 2, text: 'Decline Request', box: [40, 440, 300, 48] },
    ],
  },
  {
    id: 'electricity-bill',
    name: 'Electricity Cut Threat SMS',
    badge: 'scam',
    description: 'Fake SMS threatening power disconnection tonight.',
    dataUrl: createPhoneScreenSvg(
      'Important Utility Notice',
      'Electricity Bill Unpaid',
      `<p style="margin-bottom:8px;">Dear Consumer, your electricity power disconnection will take place tonight at 9:30 PM.</p>
       <p style="margin-bottom:8px;">Previous month bill was not updated. Call electricity officer now.</p>
       <p style="color:#B91C1C;font-weight:bold;">Install QuickSupport APK to verify.</p>`,
      [
        { text: 'Download Support APK', bg: '#DC2626', color: '#FFFFFF' },
        { text: 'Close', bg: '#F1F5F9', color: '#475569', isTarget: true }
      ],
      true
    ),
    ocrText: 'Electricity bill unpaid power disconnection tonight at 9:30 PM install quicksupport apk download support apk close',
    elements: [
      { id: 1, text: 'Download Support APK', box: [40, 380, 300, 48] },
      { id: 2, text: 'Close', box: [40, 440, 300, 48] },
    ],
  },
  {
    id: 'genuine-recharge',
    name: 'Safe Mobile Recharge',
    badge: 'safe',
    description: 'Genuine utility recharge screen on PhonePe/GPay.',
    dataUrl: createPhoneScreenSvg(
      'PhonePe Recharge',
      'Mobile Recharge: ₹299',
      `<p style="margin-bottom:8px;"><strong>Number:</strong> +91 98765 43210</p>
       <p style="margin-bottom:8px;"><strong>Plan:</strong> 1.5 GB/day, Unlimited Calls, 28 Days validity.</p>
       <p style="color:#16A34A;">Verified Official Telecom Operator</p>`,
      [
        { text: 'Confirm Recharge ₹299', bg: '#2563EB', color: '#FFFFFF', isTarget: true },
        { text: 'Cancel', bg: '#F1F5F9', color: '#475569' }
      ]
    ),
    ocrText: 'PhonePe Mobile Recharge: ₹299 Number +91 98765 43210 1.5 GB/day Unlimited Calls Confirm Recharge ₹299 Cancel',
    elements: [
      { id: 1, text: 'Confirm Recharge ₹299', box: [40, 380, 300, 48] },
      { id: 2, text: 'Cancel', box: [40, 440, 300, 48] },
    ],
  },
  {
    id: 'kyc-alert',
    name: 'Suspicious KYC Expiry Link',
    badge: 'scam',
    description: 'Phishing message urging immediate PAN/KYC link update.',
    dataUrl: createPhoneScreenSvg(
      'Account Warning',
      'KYC Expired: SIM Blocked',
      `<p style="margin-bottom:8px;">Your account KYC has expired. Your SIM card will be deactivated within 2 hours.</p>
       <p style="margin-bottom:8px;">Visit <code>sbi-kyc-update.xyz</code> immediately to verify Aadhaar.</p>`,
      [
        { text: 'Update KYC Now', bg: '#DC2626', color: '#FFFFFF' },
        { text: 'Dismiss', bg: '#F1F5F9', color: '#475569', isTarget: true }
      ],
      true
    ),
    ocrText: 'KYC expired SIM deactivated within 2 hours visit sbi-kyc-update.xyz immediately Update KYC Now Dismiss',
    elements: [
      { id: 1, text: 'Update KYC Now', box: [40, 380, 300, 48] },
      { id: 2, text: 'Dismiss', box: [40, 440, 300, 48] },
    ],
  },
];
