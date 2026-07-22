
interface PrivacyValueProps {
  value: string | undefined | null;
  permission?: string; 
  ownerId?: string; // The ID of the doctor assigned to this patient/encounter
  type?: 'phone' | 'email' | 'address' | 'text';
}

export default function PrivacyValue({ value, permission = 'PATIENT_PII_VIEW_FULL', ownerId, type = 'text' }: PrivacyValueProps) {
  const currentUserId = localStorage.getItem("userId");
  const permissions = JSON.parse(localStorage.getItem("userPermissions") || "[]");
  
  // Rule: Assigned doctors get full access regardless of general masking
  const isOwner = ownerId && currentUserId === ownerId;
  const hasGeneralAccess = permissions.includes(permission);
  
  const hasAccess = isOwner || hasGeneralAccess;

  if (!value) return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>N/A</span>;

  if (hasAccess) {
    return <span style={{ fontWeight: 600 }}>{value}</span>;
  }

  // --- MASKING LOGIC ---
  let maskedValue = value;
  
  if (type === 'phone') {
    maskedValue = value.length > 4 ? value.substring(0, 3) + "****" + value.slice(-2) : "****";
  } else if (type === 'email') {
    const [user, domain] = value.split('@');
    maskedValue = user.substring(0, 2) + "******@" + domain;
  } else {
    maskedValue = "••••••••••••";
  }

  return (
    <span 
      style={{ 
        color: '#64748b', 
        background: '#f1f5f9', 
        padding: '2px 8px', 
        borderRadius: '4px',
        fontSize: '0.9em',
        letterSpacing: '1px',
        cursor: 'help'
      }} 
      title="Restricted PII Information (Admin Masking Active)"
    >
      {maskedValue}
    </span>
  );
}
