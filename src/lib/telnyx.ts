const TELNYX_API = 'https://api.telnyx.com/v2';
const BCN_FAX_NUMBER = '+18666374972';

export interface TelnyxFaxResult {
  id: string;
  status: string;
}

export async function sendFax({
  mediaUrl,
  webhookUrl,
}: {
  mediaUrl: string;
  webhookUrl: string;
}): Promise<TelnyxFaxResult> {
  const response = await fetch(`${TELNYX_API}/faxes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
    },
    body: JSON.stringify({
      connection_id: process.env.TELNYX_CONNECTION_ID,
      to: BCN_FAX_NUMBER,
      from: process.env.TELNYX_FROM_NUMBER,
      media_url: mediaUrl,
      webhook_url: webhookUrl,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Telnyx fax send failed: ${JSON.stringify(err)}`);
  }

  const json = await response.json();
  return { id: json.data.id, status: json.data.status };
}
