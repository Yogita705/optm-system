import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import './App.css';
import { 
  collection, addDoc, getDocs, updateDoc, doc, query, orderBy, serverTimestamp, arrayUnion, onSnapshot 
} from 'firebase/firestore';
import { 
  User, Video, FileText, Users, Stethoscope, CheckCircle, Clock, 
  ChevronRight, ArrowLeft, Activity, ShoppingBag, ShieldCheck,
  Search, RefreshCw, Lock, LogIn, LogOut, Eye, EyeOff, ChevronDown, History
} from 'lucide-react';
function OptmLogo({ className = "h-8 w-auto" }) {
  return (
    <img 
      src="/optm-logo.png" 
      alt="OPTM Logo" 
      className={className} 
      style={{ objectFit: 'contain' }}
    />
  );
}
const PACKAGES = {
  'two_limbs': {
    name: 'Two Limbs (Upper / Lower) Package',
    sittings: {
      6: {
        combo: 5580, proflex: 1620, sachet: 990, crystal: 990, treatment: 9000, net: 18180,
        qty: { combo: 1, proflex: 1, sachet: 10, crystal: 1, treatment: 6 }
      },
      21: {
        combo: 27900, proflex: 1620, sachet: 2475, crystal: 3960, treatment: 31500, net: 67455,
        qty: { combo: 5, proflex: 1, sachet: 25, crystal: 4, treatment: 21 }
      },
      42: {
        combo: 50220, proflex: 3240, sachet: 4950, crystal: 3960, treatment: 63000, net: 125370,
        qty: { combo: 9, proflex: 2, sachet: 50, crystal: 4, treatment: 42 }
      }
    }
  },
  'four_limbs': {
    name: 'Four Limbs (Neck, Back & Legs) Package',
    sittings: {
      6: {
        combo: 5580, proflex: 1620, sachet: 990, crystal: 990, treatment: 13200, net: 22380,
        qty: { combo: 1, proflex: 1, sachet: 10, crystal: 1, treatment: 6 }
      },
      21: {
        combo: 33480, proflex: 1620, sachet: 2475, crystal: 1980, treatment: 46200, net: 85755,
        qty: { combo: 6, proflex: 1, sachet: 25, crystal: 2, treatment: 21 }
      },
      42: {
        combo: 66960, proflex: 3240, sachet: 4950, crystal: 3960, treatment: 92400, net: 171510,
        qty: { combo: 12, proflex: 2, sachet: 50, crystal: 4, treatment: 42 }
      }
    }
  }
};
const calculatePainScore = (form) => {
  let score = 0;
  const activeComplaints = Object.values(form.complaints || {}).filter(Boolean).length;
  score += Math.min(activeComplaints * 5, 25);
  const activeSensations = Object.values(form.sensations || {}).filter(Boolean).length;
  score += Math.min(activeSensations * 6, 20);
  const activeGeneralLocs = Object.values(form.generalLocations || {}).filter(Boolean).length;
  score += Math.min(activeGeneralLocs * 3, 20);
  const activeDetailedLocs = Object.values(form.painLocationsDetailed || {}).filter(val => val !== 'None').length;
  score += Math.min(activeDetailedLocs * 4, 15);
  if (form.dmYears && parseInt(form.dmYears) > 0) score += 5;
  if (form.ht === 'Yes') score += 5;
  if (form.diabeticNeuropathy === 'Yes') score += 5;
  if (form.periodOfSuffering?.toLowerCase().includes('year') || form.periodOfSuffering?.toLowerCase().includes('month')) {
    score += 5;
  }
  return Math.min(score, 100);
};
const getRecommendedSittings = (score) => {
  if (score < 30) return { sittings: '6', label: 'Mild Clinical Stress' };
  if (score >= 30 && score < 65) return { sittings: '21', label: 'Moderate Chronic Degeneration' };
  return { sittings: '42', label: 'Severe / Multi-Limb Pathology' };
};
export default function App() {
  const ALL_VIEWS = ['patient', 'frontoffice', 'doctor', 'nutritionist'];
  const USER_ACCOUNTS = [
    { 
      username: 'drmanoj', 
      name: 'Dr. Manoj', 
      password: 'Manoj@2026', 
      allowedViews: ALL_VIEWS 
    },
    { 
      username: 'prabh', 
      name: 'Prabh', 
      password: 'Prabh@2026', 
      allowedViews: ALL_VIEWS 
    },
    { 
      username: 'veeky', 
      name: 'Veeky', 
      password: 'Veeky@2026', 
      allowedViews: ALL_VIEWS 
    },
    { 
      username: 'yogita', 
      name: 'Yogita', 
      password: 'Yogita@2026', 
      allowedViews: ALL_VIEWS 
    },
    { 
      username: 'grace', 
      name: 'Grace', 
      password: 'Grace@2026', 
      allowedViews: ALL_VIEWS 
    },
    { 
      username: 'sakshi', 
      name: 'Sakshi', 
      password: 'Sakshi@2026', 
      allowedViews: ALL_VIEWS 
    }
  ];
  const [manuallyOverridden, setManuallyOverridden] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('optm_current_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      const freshAccount = USER_ACCOUNTS.find(
        u => u.username.toLowerCase() === parsed.username.trim().toLowerCase()
      );
      return freshAccount ? { ...parsed, allowedViews: freshAccount.allowedViews } : parsed;
    }
    return null;
  });
  const [currentRole, setCurrentRole] = useState(() => {
    const savedRole = localStorage.getItem('optm_current_role');
    return savedRole ? savedRole : null;
  });
  const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [intakeStep, setIntakeStep] = useState('video'); 
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('optm_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('optm_current_user');
    }
  }, [currentUser]);
  useEffect(() => {
    if (currentRole) {
      localStorage.setItem('optm_current_role', currentRole);
    } else {
      localStorage.removeItem('optm_current_role');
    }
  }, [currentRole]);
  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    const user = USER_ACCOUNTS.find(
      u => u.username.toLowerCase() === loginCreds.username.trim().toLowerCase() && u.password === loginCreds.password.trim()
    );
    if (user) {
      setCurrentUser(user);
      setCurrentRole(user.allowedViews[0]); 
      setLoginCreds({ username: '', password: '' });
      triggerToast(`Welcome ${user.name}!`);
    } else {
      setLoginError('Invalid Username or Password.');
    }
  };
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogsList, setAuditLogsList] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const profileMenuRef = useRef(null);
  const fetchAuditLogs = async () => {
    setLoadingAuditLogs(true);
    try {
      const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAuditLogsList(data);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    }
    setLoadingAuditLogs(false);
  };
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showProfileMenu]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutNote, setLogoutNote] = useState('');
  const [showUndoPinModal, setShowUndoPinModal] = useState(false);
  const [undoTargetPatientId, setUndoTargetPatientId] = useState(null);
  const [undoTargetType, setUndoTargetType] = useState('opd'); 
  const [undoAdminPin, setUndoAdminPin] = useState('');
  const [undoPinError, setUndoPinError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [activePaymentPatient, setActivePaymentPatient] = useState(null);
  const [paymentModalType, setPaymentModalType] = useState('full'); 
  const [customPayAmount, setCustomPayAmount] = useState(0);
  const [selectedPayMethod, setSelectedPayMethod] = useState('UPI');
  const [paymentError, setPaymentError] = useState('');
  const confirmLogout = () => {
    localStorage.removeItem('optm_current_user');
    localStorage.removeItem('optm_current_role');
    setCurrentUser(null);
    setCurrentRole(null);
    setActiveConsultation(null);
    setEditingProfile(null);
    setShowLogoutModal(false);
    setLogoutNote('');
    triggerToast('Session ended. Logged out successfully.');
  };
  const [patients, setPatients] = useState([]);
const [toast, setToast] = useState({ show: false, message: '' });
const triggerToast = (message) => {
  setToast({ show: true, message });
  setTimeout(() => setToast({ show: false, message: '' }), 4000); 
};
  const [loading, setLoading] = useState(false);
  const [frontOfficeSearch, setFrontOfficeSearch] = useState('');
  const [frontOfficeFilter, setFrontOfficeFilter] = useState('all');
  const [activeConsultation, setActiveConsultation] = useState(null); 
  const [doctorTab, setDoctorTab] = useState('general'); 
  const [isEditingChart, setIsEditingChart] = useState(false); 
  const [editingProfile, setEditingProfile] = useState(null); 
  const [originalProfile, setOriginalProfile] = useState(null);
  const [isDemographicsLocked, setIsDemographicsLocked] = useState(true);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const computeChartVersionDiff = (vOld = {}, vNew = {}) => {
    const diffs = [];
    const processField = (oldVal, newVal, label) => {
      const o = (oldVal ?? '').toString().trim();
      const n = (newVal ?? '').toString().trim();
      if (o !== n) {
        diffs.push({ field: label, from: o || '(empty)', to: n || '(empty)' });
      }
    };
  const basicFields = [
    { key: 'periodOfSuffering', label: 'Period of Suffering' },
    { key: 'pastOperations', label: 'Past Operations' },
    { key: 'pastMajorIllness', label: 'Past Major Illness' },
    { key: 'currentMedications', label: 'Current Medications' },
    { key: 'allergies', label: 'Allergies' },
    { key: 'doctorSignature', label: 'Doctor Signature' },
    { key: 'usingPacemaker', label: 'Using Pacemaker' },
    { key: 'emotionsContribute', label: 'Emotions Contribute to Pain' },
    { key: 'needsNutritionist', label: 'Refer to Nutritionist' }
  ];
  basicFields.forEach(f => processField(vOld[f.key], vNew[f.key], f.label));
  const oldPkg = vOld.packageId || vOld.prescription?.packageId || '';
  const newPkg = vNew.packageId || vNew.prescription?.packageId || '';
  if (oldPkg !== newPkg) {
    const oldName = PACKAGES[oldPkg]?.name || oldPkg || '(empty)';
    const newName = PACKAGES[newPkg]?.name || newPkg || '(empty)';
    diffs.push({ field: 'Prescribed Package', from: oldName, to: newName });
  }
  const oldSittings = vOld.sittingsCount || vOld.prescription?.sittings || '';
  const newSittings = vNew.sittingsCount || vNew.prescription?.sittings || '';
  if (oldSittings !== newSittings) {
    diffs.push({ field: 'Prescribed Sittings', from: oldSittings ? `${oldSittings} Sittings` : '(empty)', to: `${newSittings} Sittings` });
  }
    const simpleSections = [
      { key: 'complaints', prefix: 'Complaint' },
      { key: 'diagnosis', prefix: 'Diagnosis' },
      { key: 'params', prefix: 'Vital/Parameter' },
      { key: 'manifestations', prefix: 'Manifestation' },
      { key: 'precipitatingFactors', prefix: 'Trigger Factor' },
      { key: 'physicalExams', prefix: 'Physical Exam' },
      { key: 'supplementsTaken', prefix: 'Supplement' },
      { key: 'femaleReproductive', prefix: 'Female Repro' },
      { key: 'otherHabits', prefix: 'Habit' },
      { key: 'generalLocations', prefix: 'General Location' },
      { key: 'spineChestLocations', prefix: 'Spine/Chest Location' },
      { key: 'painLocationsDetailed', prefix: 'Limb Location Details' }
    ];
    simpleSections.forEach(sec => {
      const oldObj = vOld[sec.key] || {};
      const newObj = vNew[sec.key] || {};
      const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
      allKeys.forEach(k => {
        const oldVal = oldObj[k];
        const newVal = newObj[k];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          const fieldLabel = `${sec.prefix}: ${k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').toLowerCase()}`;
          const formatVal = (v) => {
            if (v === true) return 'Yes';
            if (v === false) return 'No';
            if (v === undefined || v === null || v === '') return '(empty)';
            return v.toString();
          };
          diffs.push({
            field: fieldLabel,
            from: formatVal(oldVal),
            to: formatVal(newVal)
          });
        }
      });
    });
    const oldMeasures = vOld.measuresTaken || {};
    const newMeasures = vNew.measuresTaken || {};
    const allMeasureKeys = Array.from(new Set([...Object.keys(oldMeasures), ...Object.keys(newMeasures)]));
    allMeasureKeys.forEach(k => {
      const oM = oldMeasures[k] || {};
      const nM = newMeasures[k] || {};
      if (JSON.stringify(oM) !== JSON.stringify(nM)) {
        const label = `Measure: ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
        const formatMeasure = (m) => {
          if (!m.status) return '(empty)';
          let details = m.status;
          if (m.side) details += ` (${m.side})`;
          if (m.frequency) details += ` (${m.frequency})`;
          return details;
        };
        diffs.push({
          field: label,
          from: formatMeasure(oM),
          to: formatMeasure(nM)
        });
      }
    });
    const oldSurg = vOld.surgicalIntervention || {};
    const newSurg = vNew.surgicalIntervention || {};
    const allSurgKeys = Array.from(new Set([...Object.keys(oldSurg), ...Object.keys(newSurg)]));
    allSurgKeys.forEach(k => {
      const oS = oldSurg[k];
      const nS = newSurg[k];
      if (JSON.stringify(oS) !== JSON.stringify(nS)) {
        const label = `Surgery: ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
        const formatSurg = (s) => {
          if (typeof s === 'object' && s !== null) {
            const active = Object.keys(s).filter(sideKey => s[sideKey] === true);
            return active.length > 0 ? active.join(', ') : 'None';
          }
          return s || '(empty)';
        };
        diffs.push({
          field: label,
          from: formatSurg(oS),
          to: formatSurg(nS)
        });
      }
    });
    return diffs;
  };
  const computeDetailedDiff = (oldData = {}, newData = {}) => {
    const changes = [];
    const fieldsToTrack = [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'dob', label: 'Date of Birth' },
      { key: 'sex', label: 'Sex' },
      { key: 'phone', label: 'Mobile Number' },
      { key: 'email', label: 'Email Address' },
      { key: 'phoneR', label: 'Residence Phone' },
      { key: 'phoneO', label: 'Office Phone' },
      { key: 'address', label: 'Address' },
      { key: 'pincode', label: 'Pincode' },
      { key: 'cityState', label: 'City / State' },
      { key: 'country', label: 'Country' },
      { key: 'referredBy', label: 'Referred By' },
      { key: 'treatedInClinic', label: 'Treated in Clinic Before' }
    ];
    fieldsToTrack.forEach(({ key, label }) => {
      const oldVal = (oldData[key] ?? '').toString().trim();
      const newVal = (newData[key] ?? '').toString().trim();
      if (oldVal !== newVal) {
        changes.push({
          field: label,
          from: oldVal || '(empty)',
          to: newVal || '(empty)'
        });
      }
    });
    const oldRefs = (oldData.referralNames || []).map(r => r.trim()).filter(Boolean);
    const newRefs = (newData.referralNames || []).map(r => r.trim()).filter(Boolean);
    const addedRefs = newRefs.filter(r => !oldRefs.includes(r));
    const removedRefs = oldRefs.filter(r => !newRefs.includes(r));
    if (addedRefs.length > 0) {
      changes.push({
        field: 'Referral Name(s) Added',
        from: '-',
        to: addedRefs.join(', ')
      });
    }
    if (removedRefs.length > 0) {
      changes.push({
        field: 'Referral Name(s) Removed',
        from: removedRefs.join(', '),
        to: '-'
      });
    }
    return changes;
  };
  const [selectedPatientLogs, setSelectedPatientLogs] = useState(null);
  const logActivity = async (patientId, patientRegNo, action, details, fieldChanges = []) => {
    const now = new Date();
    const formattedTimestamp = `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    const logEntry = {
      id: 'LOG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: formattedTimestamp,
      performedBy: currentUser?.name || 'Staff',
      username: currentUser?.username || 'staff',
      role: currentRole || 'frontoffice',
      action,
      details,
      fieldChanges: fieldChanges || [],
      patientId: patientId || '',
      patientRegNo: patientRegNo || ''
    };
    try {
      await addDoc(collection(db, 'audit_logs'), {
        ...logEntry,
        createdAt: serverTimestamp()
      });
      if (patientId) {
        await updateDoc(doc(db, 'patients', patientId), {
          activityLogs: arrayUnion(logEntry)
        });
      }
    } catch (err) {
      console.error("Audit log error:", err);
    }
  };
  const handleCloseProfileEdit = () => {
    if (originalProfile && JSON.stringify(editingProfile) !== originalProfile) {
      setShowDiscardConfirm(true);
      return;
    }
    setEditingProfile(null);
    setOriginalProfile(null);
    setShowDiscardConfirm(false);
  };
  const confirmDiscardChanges = () => {
    if (activeConsultation) {
      const freshPatientRecord = patients.find(p => p.id === activeConsultation.id);
      if (freshPatientRecord) {
        openDoctorChart(freshPatientRecord);
      }
    }
    setEditingProfile(null);
    setOriginalProfile(null);
    setIsEditingChart(false); 
    setActiveConsultation(null); 
    setShowDiscardConfirm(false);
    triggerToast('Changes discarded. Returned to Doctor Desk.');
  };
  const handleSaveProfile = async (e) => {
  e.preventDefault();
  try {
    if (!originalProfile) {
      const snapshot = await getDocs(collection(db, 'patients'));
      const nextTokenNumber = snapshot.size + 1;
      const regNo = nextTokenNumber.toString();
      const now = new Date();
      const formattedTimestamp = `${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      const newDoc = await addDoc(collection(db, 'patients'), {
        ...editingProfile,
        regNo,
        registrationDate: formattedTimestamp,
        registrationTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        createdAt: serverTimestamp()
      });
      await logActivity(newDoc.id, regNo, 'Manual Registration', 'Patient registered directly by Front Office.', []);
      triggerToast(`Patient ${regNo} registered successfully!`);
    } else {
      const pRef = doc(db, 'patients', editingProfile.id);
    const { id, ...updatePayload } = editingProfile;
    if (updatePayload.dob) {
      updatePayload.age = calculateAgeFromDob(updatePayload.dob);
    }
    await updateDoc(pRef, updatePayload);
      const oldProfileData = JSON.parse(originalProfile);
      const diffs = computeDetailedDiff(oldProfileData, editingProfile);
      if (diffs.length > 0) {
        await logActivity(editingProfile.id, editingProfile.regNo, 'Profile Demographics Modified', `Modified ${diffs.length} fields.`, diffs);
      }
      triggerToast('Patient profile updated successfully!');
    }
    setEditingProfile(null);
    setOriginalProfile(null);
    setShowDiscardConfirm(false);
    fetchPatients();
  } catch (err) {
    console.error(err);
    alert('Error saving patient data');
  }
};
  const [patientInput, setPatientInput] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    dob: '',
    address: '',
    pincode: '',
    cityState: '',
    periodOfSuffering: '',
    complaints: {
      pain: false, obesity: false, thyroidism: false, paralysis: false,
      skin: false, hair: false, neural: false, kidney: false, indigestion: false,
      reflux: false, acidity: false, respiration: false, facial: false,
      swelling: false, stiffness: false, colitis: false, psychosomatic: false
    },
    generalLocations: {
      neck: false, arm: false, armpit: false, shoulder: false, back: false,
      waist: false, hands: false, fingers: false, wrist: false, groin: false,
      thigh: false, calf: false, ankle: false, feet: false, hipjoint: false,
      sternocleidomastoid: false, buttock: false, abdomen: false, forehead: false,
      heel: false, kneejoints: false, toes: false, head: false
    },
    spineChestLocations: {
      lumbosacralSpine: false, thorasicSpine: false, cervicalSpine: false, chest: false
    },
    painLocationsDetailed: {
      shoulder: 'None', arms: 'None', hands: 'None', fingers: 'None',
      hips: 'None', legs: 'None', knees: 'None', ankles: 'None', feet: 'None'
    }
  });
  const [generatedRegNo, setGeneratedRegNo] = useState('');
  const [examForm, setExamForm] = useState({
  email: '',
  dob: '',
    age: '',
    sex: '',
    address: '',
    pincode: '',
    cityState: '',
    country: '',
    referredBy: '',
    referralNames: [''],
    treatedInClinic: 'No',
    treatedWhen: '',
    treatedCured: '',
    dmYears: '',
    ht: 'No',
    diabeticNeuropathy: 'No',
    thyroid: 'No',
    periodOfSuffering: '',
    complaints: {
      pain: false, obesity: false, thyroidism: false, paralysis: false,
      skin: false, hair: false, neural: false, kidney: false, indigestion: false,
      reflux: false, acidity: false, respiration: false, facial: false,
      swelling: false, stiffness: false, colitis: false, psychosomatic: false
    },
    generalLocations: {
      neck: false, arm: false, armpit: false, shoulder: false, back: false,
      waist: false, hands: false, fingers: false, wrist: false, groin: false,
      thigh: false, calf: false, ankle: false, feet: false, hipjoint: false,
      sternocleidomastoid: false, buttock: false, abdomen: false, forehead: false,
      heel: false, kneejoints: false, toes: false, head: false
    },
    sensations: {
      pricking: false, throbbing: false, shooting: false,
      morningStiffness: false, burning: false, numbness: false, stabbing: false
    },
    painLocationsDetailed: {
      shoulder: 'None', 
      arms: 'None',
      hands: 'None',
      fingers: 'None',
      hips: 'None',
      legs: 'None',
      knees: 'None',
      ankles: 'None',
      feet: 'None'
    },
    spineChestLocations: {
      lumbosacralSpine: false,
      thorasicSpine: false,
      cervicalSpine: false,
      chest: false
    },
    pastOperations: '',
    pastMajorIllness: '',
    usingPacemaker: 'No',
    currentMedications: '',
    allergies: '',
    otherHabits: {
      tea: false,
      coffee: false,
      tobacco: false,
      alcohol: false,
      none: true
    },
    femaleReproductive: {
      uterus: '',
      ovary: '',
      menarcheAge: '',
      cycle: '',
      flow: '', 
      menopauseAge: ''
    },
    physicalExams: {
      appearance: '',
      cooperation: '',
      built: '',
      nutrition: '',
      anaemia: '',
      jaundice: '',
      oedema: '',
      lymphNeck: '',
      lymphAxillary: '',
      lymphInguinal: '',
      varicoseVeins: '',
      hernia: '',
      neckVein: '',
      skinTexture: '',
      skinColour: '',
      skinPigmentation: '',
      hairTexture: '',
      hairColour: '',
      pulse: '',
      bloodPressure: '',
      breast: '',
      lungs: '',
      liver: '',
      spleen: '',
      kidney: '',
      urination: '',
      bowelMovement: '',
      foodHabit: 'Veg' 
    },
    precipitatingFactors: {
      changingWeather: false, fatigue: false, movementOveruse: false,
      stress: false, hormonalChanges: false, cold: false, heat: false,
      humidity: false, staticPosition: false, allergy: false, others: false
    },
    emotionsContribute: 'No', 
    manifestations: {
      sweating: false, nausea: false, vomiting: false, acidity: false,
      reflux: false, dizziness: false, anaemia: false, insomnia: false,
      tiredness: false, fatigue: false, depression: false, anxiety: false,
      musclesWasting: false, weightLoss: false, weightGain: false,
      appetiteLoss: false, indigestion: false, constipation: false, others: false
    },
    params: {
      painSensationKneeRt: '',
      painSensationKneeLt: '',
      painSensationLumber: '',
      painSensationCervical: '',
      kgbRt: '', kgbLt: '',
      ctmRt: '', ctmLt: '',
      capRt: '', capLt: '',
      cbpRt: '', cbpLt: '',
      ccmRt: '', ccmLt: '',
      kfsRt: '', kfsLt: '',
      kfpRt: '', kfpLt: '',
      kfstRt: '', kfstLt: '',
      kesRt: '', kesLt: '',
      kepRt: '', kepLt: '',
      kestRt: '', kestLt: '',
      slrRt: '', slrLt: '',
      sensoryKneeRt: '', sensoryKneeLt: '',
      sensoryFootRt: '', sensoryFootLt: '',
      height: '',
      weight: '',
      bmi: '',
      pulse: '',
      bloodPressure: '',
      bodyTemp: '',
      spo2: '',
      respirationRate: '',
      bloodGlucose: ''
    },
    diagnosis: {
      cervicalSpondylosis: false,
      lumbarSpondylosis: false,
      slippedDisc: false,
      osteoarthritisKnee: false,
      calcanealSpur: false,
      varicoseVein: false,
      migraineSinusitis: false,
      sleeplessness: false,
      incontinence: false,
      constipation: false,
      acidityGas: false,
      vertigo: false,
      depression: false,
      ankylosingSpondylitis: false,
      rheumatoidArthritis: false,
      polyArthritis: false,
      custom17: '',
      custom18: '',
      custom19: '',
      custom20: ''
    },
    doctorSignature: '',
    consentGiven: false,
    consentSigneeName: '',
    patientPartySignature: '',
    patientSignature: '',
    examinerSignature: '',
    packageId: 'two_limbs', 
    sittingsCount: '21', 
    extraMedicinePurchased: false,
    nutritionist: {
      chiefComplaints: '',
      observation: '',
      occupation: '',
      lightestWeight5Years: '',
      bmi: '',
      bp: '',
      pulseRate: '',
      constipation: '',
      bloating: '',
      exercise: '',
      waterIntake: '',
      sleep: '',
      mealPreferences: '',
      familyHistory: '',
      surgicalHistory: '',
      socialHistory: '',
      stressIncontinence: '',
      bladderIrritation: '',
      foodAllergies: '',
      lastDentalCheckup: '',
      numberOfCaries: '',
      saltUsed: '',
      oilUsed: '',
      foodRecall: {
        breakfast: '',
        midmorning: '',
        lunch: '',
        eveningSnack: '',
        dinner: '',
        postDinner: ''
      },
      stressEating: '',
      bingeEating: '',
      cravings: '',
      outsideEating: '',
      doctorsNote: '',
      nutritionistsNote: ''
    }
  });
  useEffect(() => {
    if (manuallyOverridden) return;
    const computedScore = calculatePainScore(examForm);
    const recommendation = getRecommendedSittings(computedScore);
    setExamForm(prev => ({ ...prev, sittingsCount: recommendation.sittings }));
  }, [
    examForm.complaints, 
    examForm.sensations, 
    examForm.generalLocations, 
    examForm.painLocationsDetailed,
    examForm.dmYears,
    examForm.ht,
    examForm.diabeticNeuropathy,
    manuallyOverridden
  ]);
  useEffect(() => {
    if (examForm.packageId && examForm.sittingsCount) {
      const selectedPack = PACKAGES[examForm.packageId];
      if (selectedPack) {
        const sittingDetails = selectedPack.sittings[parseInt(examForm.sittingsCount)];
        if (sittingDetails) {
          setExamForm(prev => ({
            ...prev,
            prescription: {
              packageName: selectedPack.name,
              packageId: examForm.packageId,
              sittings: examForm.sittingsCount,
              cost: sittingDetails.net,
              billingDetails: sittingDetails
            }
          }));
        }
      }
    }
  }, [examForm.packageId, examForm.sittingsCount]);
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPatients(data);
      setLoading(false);
    }, (err) => {
      console.error("Error with live patient updates:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  const fetchPatients = async () => {
    triggerToast("Live queue synchronized successfully.");
  };
  const handleCheckIn = async (e) => {
    e.preventDefault();
    try {
      const snapshot = await getDocs(collection(db, 'patients'));
      const nextTokenNumber = snapshot.size + 1;
      const regNo = nextTokenNumber.toString();
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const fullTimestamp = `${formattedDate}, ${formattedTime}`;
      setGeneratedRegNo(regNo); 
      await addDoc(collection(db, 'patients'), {
        ...patientInput,
        regNo,
        registrationDate: fullTimestamp,
        registrationTime: formattedTime,
        status: 'Awaiting Consultation Payment',
        createdAt: serverTimestamp()
      });
      setIntakeStep('success');
      setPatientInput({ 
        firstName: '', 
        lastName: '', 
        phone: '', 
        email: '', 
        dob: '', 
        address: '', 
        pincode: '', 
        cityState: '' 
      });
    } catch (err) {
      alert("Error checking in. Please verify firebaseConfig.");
    }
  };
const handleCollectConsultation = async (patientId, method, feeAmount = 1500) => {
  try {
    const pat = patients.find(p => p.id === patientId);
    const pRef = doc(db, 'patients', patientId);
    await updateDoc(pRef, {
      status: 'Paid & Waiting for Doctor',
      consultationFeePaid: feeAmount,
      consultationPaymentMethod: method,
      opdPaidBy: currentUser?.name || 'Staff'
    });
    await logActivity(
      patientId,
      pat?.regNo || '',
      'OPD Fee Collected',
      `Collected ₹${feeAmount.toLocaleString('en-IN')} consultation fee via ${method}.`,
      [
        { field: 'Queue Status', from: 'Awaiting Consultation Payment', to: 'Paid & Waiting for Doctor' },
        { field: 'OPD Fee Amount', from: '₹0 (Unpaid)', to: `₹${feeAmount.toLocaleString('en-IN')}` },
        { field: 'Payment Method', from: '(none)', to: method }
      ]
    );
    fetchPatients();
    triggerToast(`Payment of ₹${feeAmount.toLocaleString('en-IN')} recorded via ${method}! Patient queued for doctor.`);
  } catch (err) {
    console.error(err);
  }
};
  const handleTriggerPackageUndo = (patientId) => {
    setUndoTargetPatientId(patientId);
    setUndoTargetType('package');
    setUndoAdminPin('');
    setUndoPinError('');
    setShowUndoPinModal(true);
  };
  const handleUpdateConsultationMethod = async (patientId, newMethod) => {
    try {
      const pat = patients.find(p => p.id === patientId);
      const pRef = doc(db, 'patients', patientId);
      if (newMethod === 'UNPAID') {
        setUndoTargetPatientId(patientId);
        setUndoTargetType('opd');
        setUndoAdminPin('');
        setUndoPinError('');
        setShowUndoPinModal(true);
        return;
      }
      const prevMethod = pat?.consultationPaymentMethod || 'UPI';
      await updateDoc(pRef, {
        consultationPaymentMethod: newMethod
      });
      await logActivity(
        patientId,
        pat?.regNo || '',
        'OPD Payment Mode Changed',
        `Corrected payment mode from ${prevMethod} to ${newMethod}.`,
        [
          { field: 'Payment Method', from: prevMethod, to: newMethod }
        ]
      );
      triggerToast(`Payment mode corrected to ${newMethod}!`);
      fetchPatients();
    } catch (err) {
      console.error(err);
    }
  };
  const confirmUndoPayment = async (e) => {
    e.preventDefault();
    setUndoPinError('');
    const isValidPin = USER_ACCOUNTS.some(u => u.password === undoAdminPin.trim()) || undoAdminPin.trim() === 'Optm@2026';
    if (!isValidPin) {
      setUndoPinError('Invalid Supervisor PIN / Password.');
      return;
    }
    try {
      const patientId = undoTargetPatientId;
      const pat = patients.find(p => p.id === patientId);
      const pRef = doc(db, 'patients', patientId);
      if (undoTargetType === 'opd') {
        const prevFee = pat?.consultationFeePaid || 1500;
        await updateDoc(pRef, {
          status: 'Awaiting Consultation Payment',
          consultationFeePaid: null,
          consultationPaymentMethod: null
        });
        await logActivity(
          patientId,
          pat?.regNo || '',
          'OPD Payment Reverted / Undone',
          `Reverted ₹${prevFee.toLocaleString('en-IN')} fee back to Unpaid status (Authorized by PIN).`,
          [
            { field: 'Queue Status', from: 'Paid & Waiting for Doctor', to: 'Awaiting Consultation Payment' },
            { field: 'OPD Fee Amount', from: `₹${prevFee.toLocaleString('en-IN')}`, to: '₹0 (Unpaid)' },
            { field: 'Payment Method', from: pat?.consultationPaymentMethod || 'Paid', to: '(none)' }
          ]
        );
        triggerToast("OPD Payment successfully undone!");
      } else {
        const prevPaid = pat?.paidAmount || pat?.prescription?.cost || 0;
        await updateDoc(pRef, {
          status: 'Prescribed & Awaiting Payment',
          paidAmount: null,
          remainingBalance: null,
          finalPaymentMethod: null
        });
        await logActivity(
          patientId,
          pat?.regNo || '',
          'Package Payment Reverted / Undone',
          `Reverted settled package payment of ₹${prevPaid.toLocaleString('en-IN')} back to Prescribed status (Authorized by PIN).`,
          [
            { field: 'Treatment Status', from: pat?.status, to: 'Prescribed & Awaiting Payment' },
            { field: 'Paid Amount', from: `₹${prevPaid.toLocaleString('en-IN')}`, to: '₹0' }
          ]
        );
        triggerToast("Package settlement undone! Status reset to Prescribed.");
      }
      setShowUndoPinModal(false);
      setUndoTargetPatientId(null);
      setUndoAdminPin('');
      fetchPatients();
    } catch (err) {
      console.error(err);
      setUndoPinError('Error processing request.');
    }
  };
  const calculateAgeFromDob = (dobStr) => {
    if (!dobStr) return '';
    const birthDate = new Date(dobStr);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    return isNaN(calculatedAge) ? '' : calculatedAge.toString();
  };
  const handlePrintPackageBill = (pat) => {
    const printWindow = window.open('', '_blank', 'width=500,height=700');
    if (!printWindow) {
      alert('Please allow popups to print the package bill receipt.');
      return;
    }
    const prescription = pat.prescription || {};
    const totalCost = prescription.cost || 0;
    const paidAmt = pat.paidAmount || totalCost;
    const balanceDue = pat.remainingBalance || 0;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OPTM Package Bill - ${pat.regNo}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 20px; margin: 0; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px solid #133f26; padding-bottom: 10px; margin-bottom: 15px; }
            .logo { font-size: 18px; font-weight: 900; color: #133f26; letter-spacing: 1px; }
            .subtitle { font-size: 10px; color: #64748b; text-transform: uppercase; margin-top: 2px; }
            .meta { margin-bottom: 15px; font-size: 11px; }
            .meta div { display: flex; justify-content: space-between; margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 4px; text-align: left; font-size: 11px; }
            th { background-color: #f8fafc; font-weight: bold; color: #334155; }
            .total-row { font-weight: bold; font-size: 12px; border-top: 2px solid #133f26; border-bottom: 2px solid #133f26; }
            .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 25px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">OPTM HEALTHCARE</div>
            <div class="subtitle">Treatment Package Invoice & Settlement Receipt</div>
          </div>
          <div class="meta">
            <div><strong>Token ID:</strong> <span>${pat.regNo}</span></div>
            <div><strong>Patient Name:</strong> <span>${pat.firstName} ${pat.lastName}</span></div>
            <div><strong>Package:</strong> <span>${prescription.packageName || 'Treatment Package'} (${prescription.sittings || '-'} Sittings)</span></div>
            <div><strong>Date:</strong> <span>${new Date().toLocaleDateString()}</span></div>
            <div><strong>Collected By:</strong> <span>${pat.finalPaymentCollectedBy || pat.opdPaidBy || 'Staff'}</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Treatment Package (${prescription.sittings || '-'} Sittings)</td>
                <td style="text-align: right;">₹${totalCost.toLocaleString('en-IN')}</td>
              </tr>
              <tr class="total-row">
                <td>Total Paid (${pat.finalPaymentMethod || 'UPI/Cash'})</td>
                <td style="text-align: right;">₹${paidAmt.toLocaleString('en-IN')}</td>
              </tr>
              ${balanceDue > 0 ? `
              <tr>
                <td style="color: #b45309; font-weight: bold;">Remaining Balance Due</td>
                <td style="text-align: right; color: #b45309; font-weight: bold;">₹${balanceDue.toLocaleString('en-IN')}</td>
              </tr>` : ''}
            </tbody>
          </table>
          <div class="footer">
            <p>Thank you for choosing OPTM HEALTHCARE.<br/>This is a computer-generated digital tax invoice.</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };
  const handlePrintOpdBill = (pat) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      alert('Please allow popups to print the bill receipt.');
      return;
    }
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OPTM Bill - ${pat.regNo}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 20px; margin: 0; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px solid #133f26; padding-bottom: 10px; margin-bottom: 15px; }
            .logo { font-size: 18px; font-weight: 900; color: #133f26; letter-spacing: 1px; }
            .subtitle { font-size: 10px; color: #64748b; text-transform: uppercase; margin-top: 2px; }
            .meta { margin-bottom: 15px; font-size: 11px; }
            .meta div { display: flex; justify-between; margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 4px; text-align: left; font-size: 11px; }
            th { background-color: #f8fafc; font-weight: bold; color: #334155; }
            .total-row { font-weight: bold; font-size: 13px; border-top: 2px solid #133f26; border-bottom: 2px solid #133f26; }
            .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 25px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">OPTM HEALTHCARE</div>
            <div class="subtitle">Limb Treatment & Research Center</div>
          </div>
          <div class="meta">
            <div><strong>Token ID:</strong> ${pat.regNo}</div>
            <div><strong>Patient Name:</strong> ${pat.firstName} ${pat.lastName}</div>
            <div><strong>Date:</strong> ${pat.registrationDate || new Date().toLocaleDateString()}</div>
            <div><strong>Collected By:</strong> ${pat.opdPaidBy || 'Staff'}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>OPD Consultation Fee</td>
                <td style="text-align: right;">₹${(pat.consultationFeePaid || 1500).toLocaleString('en-IN')}</td>
              </tr>
              <tr class="total-row">
                <td>Total Paid (${pat.consultationPaymentMethod || 'Cash/UPI'})</td>
                <td style="text-align: right;">₹${(pat.consultationFeePaid || 1500).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
          <div class="footer">
            <p>Thank you for choosing OPTM HEALTHCARE.<br/>This is a computer-generated digital receipt.</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };
  const openDoctorChart = (patient) => {
    const derivedAge = patient.age || calculateAgeFromDob(patient.dob);
    const readOnlyMode = currentRole === 'doctor' ? (patient.status !== 'Paid & Waiting for Doctor') : false;
    setManuallyOverridden(!!patient.sittingsCount);
    setActiveConsultation({ 
      ...patient, 
      age: derivedAge, 
      isReadOnly: readOnlyMode, 
    });
    setIsEditingChart(!readOnlyMode);
    setExamForm({
      firstName: patient.firstName || '',
      lastName: patient.lastName || '',
      dob: patient.dob || '',
      age: derivedAge,
      sex: patient.sex || '',
      phone: patient.phone || '',
      email: patient.email || '',
      phoneR: patient.phoneR || '', 
      phoneO: patient.phoneO || '', 
      address: patient.address || '',
      pincode: patient.pincode || '',
      cityState: patient.cityState || '',
      country: patient.country || 'India',
      referredBy: patient.referredBy || 'Walk-in',
      referralNames: patient.referralNames && patient.referralNames.length > 0 ? patient.referralNames : [''],
      treatedInClinic: patient.treatedInClinic || 'NO',
      treatedWhen: patient.treatedWhen || '',
      treatedCured: patient.treatedCured || '',
      complaints: patient.complaints || {
        pain: false, obesity: false, varicoseveins: false, urinaryincontinence: false,
        swelling: false, stiffness: false, headaches: false, sinusitis: false,
        insomnia: false, reflux: false, acidity: false, indigestion: false,
        bellspalsyfacialparalysis: false, paralysis: false, skindisorders: false,
        gynecologicaldisorders: false, dysmenorrhea: false, cellulitis: false,
        psychosomaticdisorders: false
      },
      generalLocations: patient.generalLocations || {
        neck: false, arm: false, armpit: false, shoulder: false, elbow: false, 
        back: false, waist: false, hands: false, fingers: false, groin: false, 
        thigh: false, calf: false, ankle: false, feet: false, toes: false, 
        kneejoint: false, heel: false, hipjoint: false, sternocleidomastoid: false, 
        buttock: false, abdomen: false, forehead: false, thoracic: false, lumbar: false
      },
      periodOfSuffering: patient.periodOfSuffering || '',
      spineChestLocations: patient.spineChestLocations || {
        lumbosacralSpine: false,
        thorasicSpine: false,
        cervicalSpine: false,
        chest: false
      },
      painLocationsDetailed: patient.painLocationsDetailed || {
        shoulder: 'None', arms: 'None', hands: 'None', fingers: 'None',
        hips: 'None', legs: 'None', knees: 'None', ankles: 'None', feet: 'None', heel: 'None'
      },
      precipitatingFactors: patient.precipitatingFactors || {
        changingweather: false, fatiguemovementoveruse: false, stress: false, hormonalchanges: false,
        cold: false, heat: false, humidity: false, staticposition: false, allergy: false, others: false
      },
      emotionsContribute: patient.emotionsContribute || 'No',
      manifestations: patient.manifestations || {
        sweating: false,
        nausea: false,
        vomiting: false,
        acidity: false,
        reflux: false,
        dizziness: false,
        anaemia: false,
        insomnia: false,
        tiredness: false,
        fatigue: false,
        depression: false,
        anxiety: false,
        musclewasting: false,
        weightloss: false,
        weightgain: false,
        appetiteloss: false,
        indigestion: false,
        constipation: false,
        varicosevein: false,
        urinaryincontinence: false,
        dysmenorrhea: false,
        leucorrhoea: false,
        skinallergy: false,
        crepitusduringkneeflexion: false,
        morningstiffness30minute: false
      },
      pastMajorIllness: patient.pastMajorIllness || '',
      pastOperations: patient.pastOperations || '',
      usingPacemaker: patient.usingPacemaker || 'No',
      femaleReproductive: patient.femaleReproductive || { 
        uterus: '', ovary: '', menarcheAge: '', cycle: '', flow: 'Normal', menopauseAge: '' 
      },
      otherHabits: patient.otherHabits || {
        vegetariantype: false, 
        nonvegetariantype: false,
        excessivedrinkoftea: false,
        excessivedrinkofcoffee: false,
        smoking: false,
        drinkingalcohol: false,
        chewingtobacco: false,
        freefromotherhabit: true
      },
      measuresTaken: patient.measuresTaken || {
        usingkneebraced: { status: 'NO', side: '' },
        usinglumbarbelt: { status: 'NO' },
        usingcollarbelt: { status: 'NO' },
        usingstickwalker: { status: 'NO' },
        usingparacetamolandnsaid: { status: 'NO', frequency: '' },
        undergonearthrocentesis: { status: 'NO' },
        useofhyaluronicacid: { status: 'NO' },
        useofcorticosteroidinjection: { status: 'NO' },
        ayurvedatreatment: { status: 'NO' },
        homeopatictreatment: { status: 'NO' },
        massagewithherbalorothergels: { status: 'NO' }
      },
      supplementsTaken: patient.supplementsTaken || {
        calcium: 'NO',
        vitamind: 'NO',
        glucosamine: 'NO',
        glucosamineandchondroitin: 'NO'
      },
      surgicalIntervention: patient.surgicalIntervention || {
        kneeTotal: { right: false, left: false, bilateral: false },
        kneeTotalDate: '',
        arthrocentesis: { right: false, left: false, bilateral: false },
        arthrocentesisDate: '',
        lumber: { laminectomy: false, fusion: false, discReplacement: false },
        lumberDate: '',
        cervical: { laminoplasty: false, laminectomy: false, discReplacement: false },
        cervicalDate: '',
        bypassDate: '', 
        varicose: { ablation: false, phlebectomy: false, other: false },
        varicoseDate: '',
        carpal: { right: false, left: false, bilateral: false },
        carpalDate: ''
      },
      periodOfSuffering: patient.periodOfSuffering || '', 
      consentGiven: patient.consentGiven || false,
      patientSignature: patient.patientSignature || '', 
      patientPartySignature: patient.patientPartySignature || '', 
      examinerSignature: patient.examinerSignature || '',
      params: {
        ...patient.params,
        painSensationKneeRt: patient.params?.painSensationKneeRt || '',
        painSensationKneeLt: patient.params?.painSensationKneeLt || '',
        painSensationLumber: patient.params?.painSensationLumber || '',
        painSensationCervical: patient.params?.painSensationCervical || '',
        painSensationHeel: patient.params?.painSensationHeel || '',
        womac_p1: patient.params?.womac_p1 ?? '', 
        womac_p2: patient.params?.womac_p2 ?? '', 
        womac_p3: patient.params?.womac_p3 ?? '', 
        womac_p4: patient.params?.womac_p4 ?? '', 
        womac_p5: patient.params?.womac_p5 ?? '', 
        womac_s1: patient.params?.womac_s1 ?? '', 
        womac_s2: patient.params?.womac_s2 ?? '', 
        womac_d1: patient.params?.womac_d1 ?? '',  
        womac_d2: patient.params?.womac_d2 ?? '',  
        womac_d3: patient.params?.womac_d3 ?? '',  
        womac_d4: patient.params?.womac_d4 ?? '',  
        womac_d5: patient.params?.womac_d5 ?? '',  
        womac_d6: patient.params?.womac_d6 ?? '',  
        womac_d7: patient.params?.womac_d7 ?? '',  
        womac_d8: patient.params?.womac_d8 ?? '',  
        womac_d9: patient.params?.womac_d9 ?? '',  
        womac_d10: patient.params?.womac_d10 ?? '', 
        womac_d11: patient.params?.womac_d11 ?? '', 
        womac_d12: patient.params?.womac_d12 ?? '', 
        womac_d13: patient.params?.womac_d13 ?? '', 
        womac_d14: patient.params?.womac_d14 ?? '', 
        womac_d15: patient.params?.womac_d15 ?? '', 
        womac_d16: patient.params?.womac_d16 ?? '', 
        womac_d17: patient.params?.womac_d17 ?? '', 
      },
      examinerSignatureForm2: patient.examinerSignatureForm2 || '', 
      patientSignatureForm2: patient.patientSignatureForm2 || '',   
      params: {
        ...patient.params,
        bodyTemp: patient.params?.bodyTemp || '',
        spo2: patient.params?.spo2 || '',
        pulse: patient.params?.pulse || '',
        respirationRate: patient.params?.respirationRate || '',
        bloodPressure: patient.params?.bloodPressure || '',
        bloodGlucose: patient.params?.bloodGlucose || '',
        height: patient.params?.height || '',
        weight: patient.params?.weight || '',
        waist: patient.params?.waist || '',
        hip: patient.params?.hip || '',
        bmi: patient.params?.bmi || '',
        whpr: patient.params?.whpr || '',
        whtr: patient.params?.whtr || '',
        kgbRt: patient.params?.kgbRt || '', kgbLt: patient.params?.kgbLt || '',
        capRt: patient.params?.capRt || '', capLt: patient.params?.capLt || '',
        cbpRt: patient.params?.cbpRt || '', cbpLt: patient.params?.cbpLt || '',
        ctmRt: patient.params?.ctmRt || '', ctmLt: patient.params?.ctmLt || '',
        ccmRt: patient.params?.ccmRt || '', ccmLt: patient.params?.ccmLt || '',
        slrSRt: patient.params?.slrSRt || '', slrSLt: patient.params?.slrSLt || '',
        slrPRt: patient.params?.slrPRt || '', slrPLt: patient.params?.slrPLt || '',
        kfsRt: patient.params?.kfsRt || '', kfsLt: patient.params?.kfsLt || '',
        kfpRt: patient.params?.kfpRt || '', kfpLt: patient.params?.kfpLt || '',
        kfstRt: patient.params?.kfstRt || '', kfstLt: patient.params?.kfstLt || '',
        kesRt: patient.params?.kesRt || '', kesLt: patient.params?.kesLt || '',
        kepRt: patient.params?.kepRt || '', kepLt: patient.params?.kepLt || '',
        kestRt: patient.params?.kestRt || '', kestLt: patient.params?.kestLt || '',
        crcmRt: patient.params?.crcmRt || '', crcmLt: patient.params?.crcmLt || '',
        ceaoRt: patient.params?.ceaoRt || '', ceaoLt: patient.params?.ceaoLt || '',
        ceboRt: patient.params?.ceboRt || '', ceboLt: patient.params?.ceboLt || '',
        asfsRt: patient.params?.asfsRt || '', asfsLt: patient.params?.asfsLt || '',
        asastRt: patient.params?.asastRt || '', asastLt: patient.params?.asastLt || '',
        aefsRt: patient.params?.aefsRt || '', aefsLt: patient.params?.aefsLt || '',
        aeesRt: patient.params?.aeesRt || '', aeesLt: patient.params?.aeesLt || '',
      },
      examinerSignatureForm3: patient.examinerSignatureForm3 || '', 
      patientSignatureForm3: patient.patientSignatureForm3 || '',   
      dateForm3: patient.dateForm3 || '',                           
      diagnosis: patient.diagnosis || {
        cervicalSpondylosis: false,    
        lumbarSpondylosis: false,      
        slippedDisc: false,            
        osteoarthritisKnee: false,     
        calcanealSpur: false,          
        varicoseVein: false,           
        migraineSinusitis: false,      
        sleeplessness: false,          
        incontinence: false,           
        constipation: false,           
        acidityGas: false,             
        vertigo: false,                
        depression: false,             
        ankylosingSpondylitis: false,  
        rheumatoidArthritis: false,    
        polyArthritis: false           
      },
      doctorSignature: patient.doctorSignature || '', 
      packageId: patient.packageId || patient.prescription?.packageId || '',
      sittingsCount: patient.sittingsCount || patient.prescription?.sittings || '',
      needsNutritionist: patient.needsNutritionist || false, 
      prescription: patient.prescription || {
        packageName: '',
        packageId: '',
        sittings: '',
        cost: 0,
        billingDetails: {
          combo: 0, proflex: 0, sachet: 0, crystal: 0, treatment: 0, net: 0,
          qty: { combo: 0, proflex: 0, sachet: 0, crystal: 0, treatment: 0 }
        }
      },
      nutritionist: patient.nutritionist || {
        chiefComplaints: '',
        observation: '',
        occupation: '',
        lightestWeight5Years: '',
        bmi: '',
        bp: '',
        pulseRate: '',
        mealPreferences: '',
        exercise: '',
        waterIntake: '',
        sleep: '',
        constipation: '',
        bloating: '',
        stressIncontinence: '',
        bladderIrritation: '',
        foodAllergies: '',
        familyHistory: '',
        socialHistory: '', 
        foodRecall: {
          breakfast: '',
          midmorning: '',
          lunch: '',
          eveningsnack: '',
          dinner: '',
          postdinner: ''
        },
        lastDentalCheckup: '',
        numberOfCaries: '',
        saltUsed: '',
        oilUsed: '',
        stressEating: '',
        bingeEating: '',
        cravings: '',
        outsideEating: '',
        nutritionistsNote: '', 
        doctorsNote: ''         
      }
    });
  };
  const handleSaveNutritionist = async () => {
    try {
      const pRef = doc(db, 'patients', activeConsultation.id);
      await updateDoc(pRef, {
        nutritionist: examForm.nutritionist,
        nutritionistSavedBy: currentUser?.name || 'Nutritionist',
        nutritionistSavedAt: new Date().toLocaleString('en-GB')
      });
      await logActivity(
        activeConsultation.id,
        activeConsultation.regNo,
        'Nutritionist Consultation Updated',
        `Nutritionist updated the complete dietary assessment and food recall sheet.`,
        [{ field: 'Nutrition Panel', from: 'Draft', to: 'Saved Plan' }]
      );
      setActiveConsultation(null);
      fetchPatients();
      triggerToast("Dietary plan and notes saved successfully!");
    } catch (err) {
      console.error(err);
      alert('Error saving nutritionist data.');
    }
  };
  const handleSaveConsultation = async () => {
    try {
      if (!examForm.packageId || !examForm.sittingsCount) {
        alert('Please select both a Package Category and Number of Sittings before saving.');
        return;
      }
      const pRef = doc(db, 'patients', activeConsultation.id);
      const selectedPack = PACKAGES[examForm.packageId];
      const sittingDetails = selectedPack?.sittings[parseInt(examForm.sittingsCount)];
      if (!sittingDetails) {
        alert('Invalid package configuration selected.');
        return;
      }
      const clinicalDiffs = computeChartVersionDiff(activeConsultation, examForm);
      const currentStatus = activeConsultation?.status || 'Prescribed & Awaiting Payment';
      const targetStatus = currentStatus.startsWith('Treatment Active') 
        ? currentStatus 
        : 'Prescribed & Awaiting Payment';
      await updateDoc(pRef, {
        ...examForm,
        status: targetStatus,
        prescribedBy: currentUser?.name || 'Doctor',
        prescription: {
          packageName: selectedPack.name,
          packageId: examForm.packageId,
          sittings: examForm.sittingsCount,
          cost: sittingDetails.net,
          billingDetails: sittingDetails
        }
      });
      await logActivity(
        activeConsultation.id,
        activeConsultation.regNo,
        'Treatment Package Prescribed',
        `Prescribed treatment package and sent to billing queue. Filled clinical examination records.`,
        [
          { field: 'Queue Status', from: 'Paid & Waiting for Doctor', to: 'Prescribed & Awaiting Payment' },
          { field: 'Package Prescribed', from: '(none)', to: selectedPack.name },
          { field: 'Number of Sittings', from: '0', to: `${examForm.sittingsCount} Sittings` },
          { field: 'Net Package Cost', from: '₹0', to: `₹${sittingDetails.net.toLocaleString('en-IN')}` },
          ...clinicalDiffs
        ]
      );
      setActiveConsultation(null);
      fetchPatients();
      triggerToast("Medical record saved & package prescribed!");
    } catch (err) {
      console.error(err);
    }
  };
  const handleUpdateChart = async () => {
    try {
      const pRef = doc(db, 'patients', activeConsultation.id);
      const diffs = computeChartVersionDiff(activeConsultation, examForm);
      const totalCost = examForm.prescription?.cost || 0;
      const currentPaid = activeConsultation.paidAmount || 0;
      const newRemaining = Math.max(0, totalCost - currentPaid);
      let updatedStatus = activeConsultation.status || 'Prescribed & Awaiting Payment';
      if (activeConsultation.status?.startsWith('Treatment Active')) {
        updatedStatus = newRemaining === 0 
          ? 'Treatment Active (Fully Paid)' 
          : 'Treatment Active (Partial Advance)';
      }
      await updateDoc(pRef, {
        ...examForm,
        paidAmount: currentPaid,
        remainingBalance: newRemaining,
        status: updatedStatus,
        lastModifiedBy: currentUser?.name || 'Doctor',
        lastModifiedAt: serverTimestamp()
      });
      await logActivity(
        activeConsultation.id,
        activeConsultation.regNo,
        'Medical Chart Updated',
        `Doctor updated the clinical record. Modified ${diffs.length} specific clinical fields.`,
        diffs
      );
      setActiveConsultation(null);
      setIsEditingChart(false);
      fetchPatients();
      triggerToast(`Patient chart updated and changes logged successfully.`);
    } catch (err) {
      console.error(err);
      alert('Error updating chart.');
    }
  };
  const handleFinalCheckout = async (patientId, method, totalCost) => {
    try {
      const pat = patients.find(p => p.id === patientId);
      const pRef = doc(db, 'patients', patientId);
      await updateDoc(pRef, {
        status: 'Treatment Active (Fully Paid)',
        finalPaymentMethod: method,
        paidAmount: totalCost,
        remainingBalance: 0,
        finalPaymentCollectedBy: currentUser?.name || 'Staff',
        completedAt: serverTimestamp()
      });
      await logActivity(
        patientId,
        pat?.regNo || '',
        'Final Package Payment Settled',
        `Collected full package payment of ₹${totalCost.toLocaleString('en-IN')}. Treatment plan is active.`,
        [
          { field: 'Treatment Status', from: 'Prescribed & Awaiting Payment', to: 'Treatment Active (Fully Paid)' },
          { field: 'Final Payment Method', from: '(pending)', to: method },
          { field: 'Amount Paid', from: '₹0', to: `₹${totalCost.toLocaleString('en-IN')}` }
        ]
      );
      fetchPatients();
      triggerToast("Treatment package activated & fully settled!");
    } catch (err) {
      console.error(err);
    }
  };
  const handlePartialCheckout = async (patientId, advanceAmount, method) => {
    try {
      const pat = patients.find(p => p.id === patientId);
      const totalCost = pat?.prescription?.cost || 0;
      const remaining = Math.max(0, totalCost - advanceAmount);
      const pRef = doc(db, 'patients', patientId);
      await updateDoc(pRef, {
        status: 'Treatment Active (Partial Advance)',
        finalPaymentMethod: method,
        paidAmount: advanceAmount,
        remainingBalance: remaining,
        finalPaymentCollectedBy: currentUser?.name || 'Staff'
      });
      await logActivity(
        patientId,
        pat?.regNo || '',
        'Partial Advance Payment Collected',
        `Collected advance installment of ₹${advanceAmount.toLocaleString('en-IN')} via ${method}. Remaining Balance: ₹${remaining.toLocaleString('en-IN')}.`,
        [
          { field: 'Treatment Status', from: 'Prescribed & Awaiting Payment', to: 'Treatment Active (Partial Advance)' },
          { field: 'Advance Paid', from: '₹0', to: `₹${advanceAmount.toLocaleString('en-IN')}` },
          { field: 'Remaining Balance', from: `₹${totalCost.toLocaleString('en-IN')}`, to: `₹${remaining.toLocaleString('en-IN')}` }
        ]
      );
      fetchPatients();
      triggerToast(`Advance of ₹${advanceAmount.toLocaleString('en-IN')} recorded! Treatment activated.`);
    } catch (err) {
      console.error(err);
    }
  };
  const handlePayInstallment = async (patientId, installmentAmount) => {
    try {
      const pat = patients.find(p => p.id === patientId);
      const currentPaid = pat?.paidAmount || 0;
      const totalCost = pat?.prescription?.cost || 0;
      const newPaid = currentPaid + installmentAmount;
      const newRemaining = Math.max(0, totalCost - newPaid);
      const newStatus = newRemaining === 0 ? 'Treatment Active (Fully Paid)' : 'Treatment Active (Partial Advance)';
      const pRef = doc(db, 'patients', patientId);
      await updateDoc(pRef, {
        status: newStatus,
        paidAmount: newPaid,
        remainingBalance: newRemaining
      });
      await logActivity(
        patientId,
        pat?.regNo || '',
        'Installment Payment Collected',
        `Collected installment of ₹${installmentAmount.toLocaleString('en-IN')}. New Total Paid: ₹${newPaid.toLocaleString('en-IN')}, Balance Due: ₹${newRemaining.toLocaleString('en-IN')}.`,
        [
          { field: 'Total Paid', from: `₹${currentPaid.toLocaleString('en-IN')}`, to: `₹${newPaid.toLocaleString('en-IN')}` },
          { field: 'Remaining Balance', from: `₹{(pat.remainingBalance || 0).toLocaleString('en-IN')}`, to: `₹${newRemaining.toLocaleString('en-IN')}` }
        ]
      );
      fetchPatients();
      triggerToast(`Installment of ₹${installmentAmount.toLocaleString('en-IN')} recorded successfully!`);
    } catch (err) {
      console.error(err);
    }
  };
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col">
      <header className="bg-optm-green/95 backdrop-blur-md text-white py-2.5 px-5 shadow-sm sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-white/10">
        <div className="flex items-center space-x-3.5">
          <OptmLogo className="h-7 w-auto" />
          <div className="hidden md:flex items-center space-x-2 border-l border-white/20 pl-3.5">
          </div>
        </div>
        {currentUser ? (
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-2.5 bg-black/25 hover:bg-black/40 p-1.5 pr-3 rounded-2xl border border-white/15 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <div className="w-7 h-7 rounded-xl bg-optm-goldenrod text-optm-green font-black text-xs flex items-center justify-center shadow-xs">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left leading-tight hidden sm:block">
                <span className="text-xs font-extrabold text-white block leading-none">{currentUser.name}</span>
                <span className="text-[9px] text-optm-goldenrod/90 font-bold uppercase tracking-wider block mt-0.5">
                  {currentRole === 'doctor' ? "Doctor's Desk" : currentRole === 'frontoffice' ? 'Front Desk' : 'Welcome Kiosk'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-white/70 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-fade-in text-slate-800 space-y-1.5">
                  <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-150">
                    <span className="text-[10px] font-black uppercase text-optm-green tracking-wider block">Signed in as</span>
                    <span className="text-xs font-black text-slate-900 block truncate">{currentUser.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium block capitalize">Active: {currentRole === 'doctor' ? "Doctor's Desk" : currentRole === 'frontoffice' ? 'Front Desk' : 'Welcome Kiosk'}</span>
                  </div>
                  <div className="space-y-0.5 pt-1">
                    <span className="text-[9px] font-black uppercase text-slate-400 px-2.5 block tracking-widest">
                      Switch View
                    </span>
                    {currentUser.allowedViews.includes('patient') && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentRole('patient');
                          setActiveConsultation(null);
                          setShowProfileMenu(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          currentRole === 'patient'
                            ? 'bg-optm-green/10 text-optm-green'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Video className="w-4 h-4 text-slate-600" />
                          <span>Welcome Kiosk</span>
                        </div>
                        {currentRole === 'patient' && <span className="w-2 h-2 rounded-full bg-optm-green"></span>}
                      </button>
                    )}
                    {currentUser.allowedViews.includes('frontoffice') && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentRole('frontoffice');
                          setActiveConsultation(null);
                          setShowProfileMenu(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          currentRole === 'frontoffice'
                            ? 'bg-optm-green/10 text-optm-green'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-600" />
                          <span>Front Desk</span>
                        </div>
                        {currentRole === 'frontoffice' && <span className="w-2 h-2 rounded-full bg-optm-green"></span>}
                      </button>
                    )}
                    {currentUser.allowedViews.includes('doctor') && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentRole('doctor');
                          setShowProfileMenu(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          currentRole === 'doctor'
                            ? 'bg-optm-green/10 text-optm-green'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-4 h-4 text-slate-600" />
                          <span>Doctor's Desk</span>
                        </div>
                        {currentRole === 'doctor' && <span className="w-2 h-2 rounded-full bg-optm-green"></span>}
                      </button>
                    )}
                    {currentUser.allowedViews.includes('nutritionist') && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentRole('nutritionist');
                          setActiveConsultation(null);
                          setShowProfileMenu(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          currentRole === 'nutritionist'
                            ? 'bg-optm-green/10 text-optm-green'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-600" />
                          <span>Nutritionist Desk</span>
                        </div>
                        {currentRole === 'nutritionist' && <span className="w-2 h-2 rounded-full bg-optm-green"></span>}
                      </button>
                    )}
                  </div>
                  <div className="border-t border-slate-150 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        fetchAuditLogs();
                        setShowAuditModal(true);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-2 cursor-pointer"
                    >
                      <History className="w-4 h-4 text-optm-green" />
                      <span>Activity & Audit Logs</span>
                    </button>
                  </div>
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowLogoutModal(true);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-extrabold text-red-600 hover:bg-red-50 transition flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-red-600" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-2 bg-black/20 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-optm-goldenrod animate-pulse"></span>
            <span className="text-[10px] text-optm-goldenrod font-bold uppercase tracking-widest">OPTM Auth Portal</span>
          </div>
        )}
      </header>
      <main className="flex-grow flex flex-col p-3 md:py-4 md:px-5 w-full mx-auto">
        {/* =======================================================================
            SINGLE LOGIN SCREEN (ACCORDING TO NAME & ACCESS)
            ======================================================================= */}
        {!currentUser && (
          <div className="flex-grow flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 md:p-8 max-w-sm w-full animate-fade-in space-y-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-optm-green/10 text-optm-green flex items-center justify-center mx-auto mb-2 border border-optm-green/20">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-black text-slate-900">OPTM Portal Login</h2>  
              </div>
              <form onSubmit={handleLogin} className="space-y-3.5">
                {loginError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-xl text-center">
                    {loginError}
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Username / Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your username"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green"
                    value={loginCreds.username}
                    onChange={e => setLoginCreds({ ...loginCreds, username: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Enter your password"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green"
                      value={loginCreds.password}
                      onChange={e => setLoginCreds({ ...loginCreds, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-500" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-optm-green hover:bg-opacity-95 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  <LogIn className="w-4 h-4 text-optm-goldenrod" />
                  <span>Sign In</span>
                </button>
              </form>
            </div>
          </div>
        )}
        {/* =======================================================================
            WORKSPACE 1: PATIENT WELCOME TERMINAL (STEP 1)
            ======================================================================= */}
        {currentRole === 'patient' && (
          <div className="flex-grow flex flex-col items-center justify-center max-w-lg mx-auto w-full py-6">
            {intakeStep === 'video' && (
              <div className="bg-white rounded-2xl shadow-md overflow-hidden w-full border border-slate-200">
                <div className="bg-optm-green text-white py-4 px-6 text-center border-b border-optm-goldenrod/25">
                  <h1 className="text-lg font-bold text-optm-goldenrod">Welcome to OPTM Limb Treatment Center</h1>
                  <p className="text-optm-gray text-xs mt-0.5">Please watch this quick overview video before completing your entry</p>
                </div>
                <div className="aspect-video bg-black relative">
                  <iframe 
                    className="w-full h-full"
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ" 
                    title="OPTM Treatment Overview"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="p-4 bg-optm-alabaster flex justify-between items-center border-t border-optm-gray">
                  <span className="text-[11px] text-optm-green font-medium flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1 text-optm-green" /> Complete video, then proceed.
                  </span>
                  <button 
                    onClick={() => setIntakeStep('form')}
                    className="bg-optm-green hover:bg-opacity-90 !text-white font-bold py-2 px-5 rounded-xl text-xs shadow transition-all flex items-center cursor-pointer"
                    style={{ color: '#ffffff' }}
                  >
                    <span className="text-white font-bold mr-1">Start Check-In</span>
                    <ChevronRight className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              </div>
            )}
            {intakeStep === 'form' && (
              <div className="bg-white rounded-2xl shadow-sm border border-optm-gray p-5 md:p-6 w-full">
                <div className="border-b border-optm-gray pb-3 mb-4">
                  <h2 className="text-base font-extrabold text-optm-green flex items-center">
                    <User className="mr-1.5 text-optm-green w-4 h-4" /> Patient Self Check-In
                  </h2>
                  <p className="text-[11px] text-optm-green/80 mt-0.5">Please enter your basic contact details. The Doctor will fill your clinical chart inside.</p>
                </div>
                <form onSubmit={handleCheckIn} className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-optm-green uppercase mb-1">First Name *</label>
                      <input 
                        type="text" required placeholder="Tarun"
                        className="w-full border border-optm-gray rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-optm-green text-xs bg-white"
                        value={patientInput.firstName}
                        onChange={e => setPatientInput({...patientInput, firstName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-optm-green uppercase mb-1">Last Name *</label>
                      <input 
                        type="text" required placeholder="Bhagat"
                        className="w-full border border-optm-gray rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-optm-green text-xs bg-white"
                        value={patientInput.lastName}
                        onChange={e => setPatientInput({...patientInput, lastName: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-optm-green uppercase mb-1">Phone Number *</label>
                      <input 
                        type="tel" required placeholder="9355221057"
                        className="w-full border border-optm-gray rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-optm-green text-xs bg-white"
                        value={patientInput.phone}
                        onChange={e => setPatientInput({...patientInput, phone: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-optm-green uppercase mb-1">Email Address <span className="text-slate-400 font-normal lowercase">(optional)</span></label>
                      <input 
                        type="email" placeholder="tarun.bhagat@gmail.com"
                        className="w-full border border-optm-gray rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-optm-green text-xs bg-white"
                        value={patientInput.email}
                        onChange={e => setPatientInput({...patientInput, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-optm-green uppercase mb-1">Date of Birth *</label>
                      <input 
                        type="date" required
                        className="w-full border border-optm-gray rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-optm-green text-xs bg-white"
                        value={patientInput.dob}
                        onChange={e => setPatientInput({...patientInput, dob: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-optm-green uppercase mb-1">Address *</label>
                      <input 
                        type="text" required placeholder="House / Street / Locality"
                        className="w-full border border-optm-gray rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-optm-green text-xs bg-white"
                        value={patientInput.address}
                        onChange={e => setPatientInput({...patientInput, address: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-optm-green uppercase mb-1">Pincode *</label>
                      <input 
                        type="text" required placeholder="110008"
                        className="w-full border border-optm-gray rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-optm-green text-xs bg-white"
                        value={patientInput.pincode}
                        onChange={e => setPatientInput({...patientInput, pincode: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-optm-green uppercase mb-1">City / State *</label>
                      <input 
                        type="text" required placeholder="Kolkata, WB"
                        className="w-full border border-optm-gray rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-optm-green text-xs bg-white"
                        value={patientInput.cityState}
                        onChange={e => setPatientInput({...patientInput, cityState: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <button 
                      type="button" onClick={() => setIntakeStep('video')}
                      className="w-1/3 bg-optm-alabaster hover:bg-optm-gray/30 text-optm-green font-bold py-2 px-3 rounded-lg transition text-xs cursor-pointer border border-optm-gray"
                    >
                      Back
                    </button>
                    <button 
                      type="submit" 
                      className="w-2/3 bg-optm-green hover:bg-opacity-95 !text-white font-bold py-2 px-3 rounded-lg shadow-sm transition-all text-xs cursor-pointer"
                      style={{ color: '#ffffff' }}
                    >
                      <span className="text-white font-bold">Check In Successfully</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
{intakeStep === 'success' && (
  <div className="relative max-w-md w-full animate-fade-in mx-auto">
    <div className="absolute -inset-1 bg-gradient-to-tr from-optm-green to-optm-goldenrod rounded-3xl blur-xl opacity-15"></div>
    <div className="relative bg-white rounded-3xl shadow-sm border border-optm-gray/40 p-8 text-center">
      <div className="relative w-16 h-16 mx-auto mb-6 flex items-center justify-center">
        <div className="absolute inset-0 bg-optm-goldenrod/20 rounded-full"></div>
        <CheckCircle className="w-8 h-8 text-optm-green relative z-10" />
      </div>
<h2 className="text-3xl font-black text-optm-green tracking-tight">Welcome to OPTM</h2>
<p className="text-optm-green/80 text-xs font-bold tracking-widest uppercase mt-1.5">
  Check-In Confirmed
</p>
      <div className="bg-optm-alabaster border border-optm-gray/60 rounded-2xl py-5 px-6 my-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-optm-green"></div>
        <span className="text-[10px] font-bold text-optm-green/60 uppercase tracking-[0.15em] block">Your Clinic Token</span>
        <div className="border-t border-dashed border-optm-gray my-2.5"></div>
        <span className="text-3xl font-black text-optm-green tracking-widest font-mono block">
          {generatedRegNo}
        </span>
      </div>
      <div className="my-6 space-y-4 text-left px-2">
        <div className="flex items-start space-x-3.5">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-optm-goldenrod border border-optm-gray text-optm-green text-xs font-bold flex items-center justify-center">
            1
          </div>
          <div>
            <h4 className="text-xs font-bold text-optm-green uppercase tracking-wider">Proceed to Reception</h4>
            <p className="text-xs text-optm-green/70 mt-0.5 font-medium">Please present your token number to the front desk executive.</p>
          </div>
        </div>
        <div className="flex items-start space-x-3.5">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-optm-goldenrod border border-optm-gray text-optm-green text-xs font-bold flex items-center justify-center">
            2
          </div>
          <div>
            <h4 className="text-xs font-bold text-optm-green uppercase tracking-wider">Consultation Registration</h4>
            <p className="text-xs text-optm-green/70 mt-0.5 font-medium">Settle the OPD consultation fee of ₹1500 to begin your clinical examination.</p>
          </div>
        </div>
      </div>
<button 
  onClick={() => setIntakeStep('video')}
  className="group w-full mt-4 py-4 px-6 rounded-2xl font-extrabold text-xs uppercase tracking-widest text-white bg-optm-green hover:bg-optm-goldenrod hover:text-optm-green transition-all duration-300 shadow-[0_8px_30px_rgba(19,63,38,0.12)] hover:shadow-optm-green/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] flex items-center justify-center space-x-2 cursor-pointer"
>
  <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-1" />
  <span>Return to Welcome Screen</span>
</button>
    </div>
  </div>
)}
          </div>
        )}
        {/* =======================================================================
            WORKSPACE 2: FRONT OFFICE DESK (HIGH-END CLINICAL PORTAL)
            ======================================================================= */}
        {currentRole === 'frontoffice' && (
          <div className="space-y-3">
            {(() => {
              const opdRevenue = patients.filter(p => p.consultationFeePaid).reduce((acc, p) => acc + (Number(p.consultationFeePaid) || 0), 0);
              const packageRevenue = patients.filter(p => p.status === 'Treatment Active (Fully Paid)').reduce((acc, p) => acc + (Number(p.prescription?.cost) || 0), 0);
              const totalRevenue = opdRevenue + packageRevenue;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {[
                    { 
                      title: 'Total Tokens', 
                      count: patients.length, 
                      sub: 'Registered',
                      badge: 'All',
                      border: 'border-slate-200 bg-slate-50/50',
                      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
                      dot: 'bg-slate-500'
                    },
                    { 
                      title: 'Needs OPD Fee', 
                      count: patients.filter(p => p.status === 'Awaiting Consultation Payment').length, 
                      sub: '₹1,500 Due',
                      badge: 'Unpaid',
                      border: 'border-amber-200/80 bg-amber-50/30',
                      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
                      dot: 'bg-amber-500'
                    },
                    { 
                      title: 'In OPD Queue', 
                      count: patients.filter(p => p.status === 'Paid & Waiting for Doctor').length, 
                      sub: 'With Doctor',
                      badge: 'Live',
                      border: 'border-sky-200/80 bg-sky-50/30',
                      badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
                      dot: 'bg-sky-500 animate-pulse'
                    },
                    { 
                      title: 'Prescribed', 
                      count: patients.filter(p => p.status === 'Prescribed & Awaiting Payment').length, 
                      sub: 'Awaiting Bill',
                      badge: 'Checkout',
                      border: 'border-purple-200/80 bg-purple-50/30',
                      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
                      dot: 'bg-purple-500'
                    },
                    { 
                      title: 'Active Treated', 
                      count: patients.filter(p => p.status === 'Treatment Active (Fully Paid)').length, 
                      sub: 'Settled Plans',
                      badge: 'Paid',
                      border: 'border-emerald-200/80 bg-emerald-50/30',
                      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                      dot: 'bg-emerald-600'
                    },
                    { 
                      title: 'Collections', 
                      count: `₹${totalRevenue >= 100000 ? (totalRevenue / 100000).toFixed(1) + 'L' : totalRevenue.toLocaleString('en-IN')}`, 
                      sub: 'OPD + Plans',
                      badge: 'Revenue',
                      border: 'border-teal-200/80 bg-teal-50/30',
                      badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
                      dot: 'bg-teal-600'
                    }
                  ].map((kpi, idx) => (
                    <div key={idx} className={`bg-white rounded-lg py-1.5 px-2.5 border ${kpi.border} shadow-2xs flex items-center justify-between transition hover:shadow-xs`}>
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="text-base font-black text-slate-900 font-mono leading-none flex-shrink-0">{kpi.count}</span>
                        <div className="leading-tight truncate">
                          <div className="text-[9.5px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1 truncate">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${kpi.dot}`}></span>
                            <span className="truncate">{kpi.title}</span>
                          </div>
                          <span className="text-[8px] font-medium text-slate-400 block truncate">{kpi.sub}</span>
                        </div>
                      </div>
                      <span className={`text-[7.5px] font-extrabold px-1 py-0.2 rounded-full border flex-shrink-0 ml-1 ${kpi.badgeColor}`}>
                        {kpi.badge}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
<div className="py-2.5 px-3.5 border-b border-slate-150 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2.5">
  <div className="relative flex-grow max-w-sm">
    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
    <input 
      type="text"
      placeholder="Search token, name, or phone..."
      className="w-full pl-8 pr-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-optm-green/30 focus:border-optm-green transition shadow-2xs"
      value={frontOfficeSearch}
      onChange={e => setFrontOfficeSearch(e.target.value)}
    />
  </div>
  <div className="flex items-center space-x-2">
<button 
  onClick={() => {
    setEditingProfile({
      firstName: '', lastName: '', phone: '', email: '', dob: '', address: '', pincode: '', cityState: '',
      referralNames: [''], referredBy: 'Walk-in', status: 'Awaiting Consultation Payment',
      complaints: {}, generalLocations: {}, painLocationsDetailed: {}, spineChestLocations: {}
    });
    setOriginalProfile(null); 
  }}
  title="Register New Walk-in Patient"
  className="relative p-2 bg-emerald-700 hover:bg-emerald-600 text-slate-900 rounded-xl shadow-md transition-all active:scale-90 cursor-pointer border border-emerald-800 group flex items-center justify-center"
>
  <User className="w-5 h-5" />
  <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-slate-900">
    +
  </span>
</button>
    <div className="h-6 w-px bg-slate-200 mx-1"></div>
    <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 shadow-2xs">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Queue:</span>
      <select 
        value={frontOfficeFilter}
        onChange={(e) => setFrontOfficeFilter(e.target.value)}
        className="bg-transparent text-[10px] font-black text-slate-800 outline-none cursor-pointer"
      >
        <option value="all">All Patients</option>
        <option value="awaiting_fee">Needs OPD Fee</option>
        <option value="doctor_queue">Queued for Doctor</option>
        <option value="prescribed">Prescribed Plans</option>
        <option value="completed">Settled</option>
      </select>
    </div>
    <button 
      onClick={fetchPatients}
      title="Refresh Live Queue"
      className="p-2 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-600 transition cursor-pointer shadow-2xs active:scale-95"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
    </button>
  </div>
</div>
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 sticky top-[53px] z-20 bg-optm-green text-white border-b border-white/10 text-[10px] font-black uppercase tracking-widest shadow-sm">
  <div className="col-span-1 flex items-center gap-1 text-optm-goldenrod">
    <span>ID</span>
  </div>
  <div className="col-span-3 text-white">
    <span>Patient Profile</span>
  </div>
  <div className="col-span-2 text-white/90">
    <span>Location & Check-In</span>
  </div>
  <div className="col-span-2 text-white font-bold">
    <span>OPD Fee Status</span>
  </div>
  <div className="col-span-3 text-right text-white">
    <span>Action Gateway</span>
  </div>
  <div className="col-span-1 text-center text-white/90">
    <span>History</span>
  </div>
</div>
              {(() => {
                const filtered = patients.filter(pat => {
                  const matchesSearch = 
                    (pat.firstName || '').toLowerCase().includes(frontOfficeSearch.toLowerCase()) ||
                    (pat.lastName || '').toLowerCase().includes(frontOfficeSearch.toLowerCase()) ||
                    (pat.regNo || '').toLowerCase().includes(frontOfficeSearch.toLowerCase()) ||
                    (pat.phone || '').includes(frontOfficeSearch);
                  if (!matchesSearch) return false;
                  if (frontOfficeFilter === 'awaiting_fee') return pat.status === 'Awaiting Consultation Payment';
                  if (frontOfficeFilter === 'doctor_queue') return pat.status === 'Paid & Waiting for Doctor';
                  if (frontOfficeFilter === 'prescribed') return pat.status === 'Prescribed & Awaiting Payment';
                  if (frontOfficeFilter === 'completed') return pat.status === 'Treatment Active (Fully Paid)' || pat.status === 'Treatment Active (Partial Advance)';
                  return true;
                });
                if (loading) {
                  return <div className="p-8 text-center text-xs font-semibold text-slate-400">Loading live patient records...</div>;
                }
                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center space-y-1">
                      <p className="text-xs font-bold text-slate-700">No patient records found</p>
                      <p className="text-[10px] text-slate-400">Try adjusting your search or queue filter.</p>
                    </div>
                  );
                }
                return (
                  <div className="divide-y divide-slate-150">
                    {filtered.map((pat) => (
                      <div key={pat.id} className="px-4 py-2.5 hover:bg-slate-50/70 transition-all grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs">
  <div className="col-span-12 md:col-span-1 flex items-center space-x-2">
  <button
    type="button"
    onClick={() => {
  const profileData = { ...pat, referralNames: pat.referralNames?.length ? pat.referralNames : [''] };
  setEditingProfile(profileData);
  setOriginalProfile(JSON.stringify(profileData));
  setIsDemographicsLocked(true); 
}}
    className="p-2 rounded-lg bg-slate-900 text-white shadow-sm hover:bg-emerald-800 transition-colors cursor-pointer active:scale-90"
  >
    <User className="w-4 h-4 text-amber-400" />
  </button>
  <span className="font-mono text-[14px] font-black text-optm-green tracking-tighter">
    {pat.regNo}
  </span>
</div>
  <div className="col-span-12 md:col-span-3 space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-slate-900 text-sm capitalize">{pat.firstName} {pat.lastName}</span>
                            {pat.dob && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                DOB: {pat.dob}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium flex flex-wrap items-center gap-x-2">
  <span>Ph: <strong className="text-slate-800 font-semibold">{pat.phone}</strong></span>
  {pat.email && <span className="text-slate-400 italic border-l border-slate-300 pl-2">{pat.email}</span>}
  {pat.referredBy && <span className="text-optm-green font-semibold">• Ref: {pat.referredBy}</span>}
</div>
                        </div>
  <div className="col-span-12 md:col-span-2 leading-tight">
  <div className="text-slate-800 font-extrabold text-[11px] whitespace-nowrap">
    {pat.cityState || 'Walk-In'}{pat.pincode && ` - ${pat.pincode}`}
  </div>
  <div className="text-[10px] text-slate-500 font-medium whitespace-nowrap flex items-center">
  <Clock className="w-3 h-3 mr-1 text-slate-400 flex-shrink-0" />
  {pat.registrationDate}
</div>
</div>
  <div className="col-span-12 md:col-span-2">
    {pat.consultationFeePaid ? (
      <div className="inline-flex flex-col bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 min-w-[100px]">
        <div className="text-[8px] font-black text-emerald-600 uppercase">OPD PAID</div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-black text-slate-900 font-mono">₹{pat.consultationFeePaid}</span>
          <span className="text-[9px] text-emerald-700 font-bold uppercase border-l border-emerald-200 pl-1.5">{pat.consultationPaymentMethod}</span>
        </div>
      </div>
    ) : (
      <div className="inline-flex flex-col bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 min-w-[100px]">
        <div className="text-[8px] font-black text-amber-600 uppercase">AWAITING FEE</div>
        <span className="text-[11px] font-bold text-slate-400">₹0.00</span>
      </div>
    )}
  </div>
  <div className="col-span-12 md:col-span-3 flex justify-start md:justify-end items-center">
                          {pat.status === 'Awaiting Consultation Payment' && (
                            <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 rounded-xl p-1.5 shadow-2xs">
                              <div className="flex items-center space-x-1.5">
                                <select 
                                  id={`opd-fee-${pat.id}`}
                                  defaultValue="1500"
                                  className="bg-white border border-amber-300 font-extrabold text-amber-950 rounded-lg px-1.5 py-1 outline-none cursor-pointer text-[10px]"
                                >
                                  <option value="1200">₹1,200</option>
                                  <option value="1500">₹1,500</option>
                                </select>
                                <div className="flex items-center space-x-1">
                                  {['Credit Card', 'Debit Card', 'UPI', 'Cash'].map(m => (
                                    <button 
                                      key={m}
                                      onClick={() => {
                                        const selectedFee = parseInt(document.getElementById(`opd-fee-${pat.id}`).value);
                                        handleCollectConsultation(pat.id, m, selectedFee);
                                      }}
                                      className="bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-400 text-slate-700 font-extrabold text-[10px] py-1 px-2 rounded-lg border border-slate-200 shadow-2xs cursor-pointer transition active:scale-95"
                                    >
                                      {m === 'Credit Card' ? 'CC' : m === 'Debit Card' ? 'DC' : m}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                          {pat.status === 'Paid & Waiting for Doctor' && (
                            <div className="flex items-center space-x-2 bg-sky-50 border border-sky-200 rounded-xl px-3 py-1.5 shadow-2xs">
                              <div className="text-right">
                                <span className="text-[11px] font-extrabold text-sky-900 flex items-center justify-end leading-tight">
                                  <Clock className="w-3.5 h-3.5 mr-1 text-sky-600" /> In Doctor Queue
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">OPD Paid (₹{(pat.consultationFeePaid || 1500).toLocaleString('en-IN')})</span>
                              </div>
                              <div className="border-l border-sky-200 pl-2 flex items-center space-x-1.5">
                                <select
                                  value={pat.consultationPaymentMethod || 'UPI'}
                                  onChange={(e) => handleUpdateConsultationMethod(pat.id, e.target.value)}
                                  className="bg-white border border-sky-300 font-bold text-sky-950 rounded-lg px-2 py-1 outline-none cursor-pointer text-[10px] hover:border-sky-500 shadow-2xs"
                                  title="Change payment method or undo"
                                >
                                  <option value="Credit Card">CC</option>
                                  <option value="Debit Card">DC</option>
                                  <option value="UPI">UPI</option>
                                  <option value="Cash">Cash</option>
                                  <option value="UNPAID">↩ Undo</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handlePrintOpdBill(pat)}
                                  className="p-1.5 bg-white hover:bg-sky-100 text-sky-800 rounded-lg border border-sky-300 transition cursor-pointer shadow-2xs"
                                  title="Print OPD Consultation Receipt"
                                >
                                  🖨️
                                </button>
                              </div>
                            </div>
                          )}
                          {pat.status === 'Prescribed & Awaiting Payment' && (
                            <div className="flex items-center space-x-2.5 bg-slate-50 border border-slate-200 rounded-xl p-2 shadow-2xs">
                              <div className="text-right pr-2.5 border-r border-slate-200">
                                <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider block">Package Due</span>
                                <span className="text-xs font-black text-slate-900 font-mono block leading-none">
                                  ₹{pat.prescription?.cost?.toLocaleString('en-IN')}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePaymentPatient(pat);
                                  setPaymentModalType('full');
                                  setCustomPayAmount('');
                                  setSelectedPayMethod('UPI');
                                  setPaymentError('');
                                setShowPaymentModal(true);
                              }}
                              className="bg-optm-green hover:bg-emerald-700 text-white font-black text-[11px] py-2.5 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                            >
                                <ShoppingBag className="w-3.5 h-3.5 text-optm-goldenrod" />
                                <span>Proceed to Payment</span>
                              </button>
                            </div>
                          )}
                          {(pat.status === 'Treatment Active (Fully Paid)' || pat.status === 'Treatment Active (Partial Advance)') && (
                            <div className="flex items-center space-x-3 bg-white border border-emerald-200/80 rounded-xl py-1.5 px-3 shadow-2xs">
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                  <span className="text-[11px] font-black text-emerald-900 tracking-wide uppercase">
                                    {pat.status === 'Treatment Active (Partial Advance)' ? 'Active • Balance Due' : 'Treatment Active • Paid'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-2">
                                  <span>Paid: <strong className="text-slate-800 font-mono">₹{(pat.paidAmount || 0).toLocaleString('en-IN')}</strong></span>
                                  {pat.remainingBalance > 0 && (
                                    <span>Due: <strong className="text-amber-700 font-mono">₹{pat.remainingBalance.toLocaleString('en-IN')}</strong></span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-1.5 border-l border-slate-150 pl-2.5">
                                {pat.remainingBalance > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActivePaymentPatient(pat);
                                      setPaymentModalType('installment');
                                      setCustomPayAmount('');
                                      setSelectedPayMethod('UPI');
                                      setPaymentError('');
                                      setShowPaymentModal(true);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] py-1.5 px-2.5 rounded-lg shadow-2xs transition cursor-pointer whitespace-nowrap active:scale-95"
                                  >
                                    Pay Due
                                  </button>
                                )}
                                <button
                                  type="button"
                                  title="Print Package Settlement Bill Receipt"
                                  onClick={() => handlePrintPackageBill(pat)}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300 transition cursor-pointer shadow-2xs"
                                >
                                  🖨️
                                </button>
                                <button
                                  type="button"
                                  title="Securely Undo / Revert Package Payment"
                                  onClick={() => handleTriggerPackageUndo(pat.id)}
                                  className="p-1.5 bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg border border-slate-200 transition cursor-pointer shadow-2xs"
                                >
                                  ↩
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="col-span-12 md:col-span-1 flex justify-start md:justify-center">
                          <button
                            type="button"
                            title="View Individual Patient Audit Trail"
                            onClick={() => setSelectedPatientLogs(pat)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-optm-goldenrod/20 text-slate-600 hover:text-optm-green border border-slate-200 transition-all duration-150 active:scale-90 cursor-pointer flex items-center justify-center"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {/* =======================================================================
            WORKSPACE 3: DOCTOR'S DESK & PATIENT DIAGNOSIS (STEP 3 & 4)
            ======================================================================= */}
        {currentRole === 'doctor' && (
          <div className="space-y-4">
            {!activeConsultation ? (
              <div className="space-y-3">
                {(() => {
                  const waitingCount = patients.filter(p => p.status === 'Paid & Waiting for Doctor').length;
                  const prescribedCount = patients.filter(p => p.status === 'Prescribed & Awaiting Payment').length;
                  const settledCount = patients.filter(p => p.status === 'Treatment Active (Fully Paid)').length;
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { title: 'Awaiting Examination', count: waitingCount, sub: 'In Doctor Queue', border: 'border-teal-200/80 bg-teal-50/30', dot: 'bg-teal-600 animate-pulse', badge: 'Live' },
                        { title: 'Prescriptions Pending', count: prescribedCount, sub: 'Sent to Billing', border: 'border-purple-200/80 bg-purple-50/30', dot: 'bg-purple-500', badge: 'Checkout' },
                        { title: 'Fully Settled Plans', count: settledCount, sub: 'Active Treatment', border: 'border-emerald-200/80 bg-emerald-50/30', dot: 'bg-emerald-600', badge: 'Complete' }
                      ].map((kpi, idx) => (
                        <div key={idx} className={`bg-white rounded-lg py-2 px-3 border ${kpi.border} shadow-2xs flex items-center justify-between transition hover:shadow-xs`}>
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <span className="text-lg font-black text-slate-900 font-mono leading-none flex-shrink-0">{kpi.count}</span>
                            <div className="leading-tight truncate">
                              <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1 truncate">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${kpi.dot}`}></span>
                                <span className="truncate">{kpi.title}</span>
                              </div>
                              <span className="text-[8.5px] font-medium text-slate-400 block truncate">{kpi.sub}</span>
                            </div>
                          </div>
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full border bg-white text-slate-700 border-slate-200 flex-shrink-0 ml-1">
                            {kpi.badge}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
                  <div className="py-2.5 px-3.5 border-b border-slate-150 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2.5">
                    <div className="relative flex-grow max-w-sm">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                      <input 
                        type="text"
                        placeholder="Search doctor queue by name, token, or phone..."
                        className="w-full pl-8 pr-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-700 text-slate-900 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400 transition shadow-2xs"
                        value={frontOfficeSearch}
                        onChange={e => setFrontOfficeSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-full font-mono text-xs font-extrabold border border-teal-500/30">
                        {patients.filter(p => p.status === 'Paid & Waiting for Doctor').length} Ready
                      </span>
                      <button 
                        onClick={fetchPatients}
                        title="Refresh Live Queue"
                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 text-white transition cursor-pointer shadow-2xs active:scale-95"
                      >
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
<div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 sticky top-[53px] z-20 bg-slate-800 text-white border-b border-white/10 text-[10px] font-black uppercase tracking-widest shadow-sm">
  <div className="col-span-2 flex items-center gap-1.5 text-teal-400">
    <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
    <span>Token / ID</span>
  </div>
  <div className="col-span-3 text-white">
    <span>Patient Profile</span>
  </div>
  <div className="col-span-2 text-white/90">
    <span>Location & Check-In</span>
  </div>
  <div className="col-span-2 text-white/90">
    <span>OPD Fee Status</span>
  </div>
                    <div className="col-span-3 text-right text-white">
                      <span>Clinical Action</span>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-150">
                    {(() => {
                      const docQueueFiltered = patients.filter(pat => {
                        if (pat.status !== 'Paid & Waiting for Doctor' && pat.status !== 'Prescribed & Awaiting Payment' && !pat.status?.startsWith('Treatment Active')) return false;
                        const matchesSearch = 
                          (pat.firstName || '').toLowerCase().includes(frontOfficeSearch.toLowerCase()) ||
                          (pat.lastName || '').toLowerCase().includes(frontOfficeSearch.toLowerCase()) ||
                          (pat.regNo || '').toLowerCase().includes(frontOfficeSearch.toLowerCase()) ||
                          (pat.phone || '').includes(frontOfficeSearch);
                        return matchesSearch;
                      });
                      if (docQueueFiltered.length === 0) {
                        return (
                          <div className="p-12 text-center space-y-1">
                            <p className="text-sm font-bold text-slate-700">No matching patients found in queue</p>
                            <p className="text-xs text-slate-400">Try adjusting your search criteria or refresh the list.</p>
                          </div>
                        );
                      }
                      return docQueueFiltered.map((pat) => (
                        <div key={pat.id} className="px-4 py-3 hover:bg-teal-50/30 transition-all grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs">
<div className="col-span-12 md:col-span-2 flex items-center space-x-2">
  <button
    type="button"
    onClick={() => {
  const profileData = { ...pat, referralNames: pat.referralNames?.length ? pat.referralNames : [''] };
  setEditingProfile(profileData);
  setOriginalProfile(JSON.stringify(profileData));
  setIsDemographicsLocked(true); 
}}
    className="p-1.5 rounded-lg bg-slate-900 text-white shadow-sm hover:bg-teal-800 transition-colors cursor-pointer active:scale-90 flex items-center justify-center"
    title="View Patient Demographics"
  >
    <User className="w-3.5 h-3.5 text-amber-400" />
  </button>
  <span className="font-mono text-[14px] font-black text-teal-900 tracking-tighter">
    {pat.regNo}
  </span>
</div>
                          <div className="col-span-12 md:col-span-3 space-y-0.5">
                            <span className="font-extrabold text-slate-900 text-sm block capitalize">{pat.firstName} {pat.lastName}</span>
                            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-x-2">
  <span>Ph: <strong className="text-slate-800 font-semibold">{pat.phone}</strong></span>
  {pat.email && <span className="text-[10px] text-slate-400 font-medium border-l border-slate-200 pl-2 lowercase">{pat.email}</span>}
</div>
                          </div>
<div className="col-span-12 md:col-span-2 space-y-0.5">
  <div className="text-slate-800 font-semibold text-[11px] whitespace-nowrap">
    {pat.cityState || 'Local Walk-In'}{pat.pincode && ` - ${pat.pincode}`}
  </div>
  <div className="text-[10px] text-slate-400 font-medium flex items-center whitespace-nowrap">
    <Clock className="w-3.5 h-3.5 mr-1 text-slate-400 flex-shrink-0" />
    {pat.registrationDate || pat.registrationTime}
  </div>
</div>
<div className="col-span-12 md:col-span-2">
  <div className={`inline-flex flex-col px-2 py-1 rounded-lg border ${pat.consultationFeePaid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
    <div className={`text-[8px] font-black uppercase ${pat.consultationFeePaid ? 'text-emerald-600' : 'text-amber-600'}`}>
      {pat.consultationFeePaid ? 'Fee Collected' : 'Payment Due'}
    </div>
    <div className="flex items-center gap-1">
      <span className="text-[11px] font-black text-slate-900 font-mono">₹{pat.consultationFeePaid || '0'}</span>
      {pat.consultationPaymentMethod && (
        <span className="text-[9px] text-slate-500 font-bold uppercase border-l border-slate-300 pl-1">{pat.consultationPaymentMethod}</span>
      )}
    </div>
  </div>
</div>
                          <div className="col-span-12 md:col-span-3 flex items-center justify-start md:justify-end space-x-2">
                            {pat.status === 'Prescribed & Awaiting Payment' && (
                              <span className="bg-purple-100 text-purple-800 border border-purple-300 px-2 py-1 rounded-lg text-[10px] font-extrabold font-mono">
                                Prescribed (₹{pat.prescription?.cost?.toLocaleString('en-IN')})
                              </span>
                            )}
                            {pat.status?.startsWith('Treatment Active') && (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-1 rounded-lg text-[10px] font-extrabold">
                                Package Active
                              </span>
                            )}
                            <button 
                              onClick={() => openDoctorChart(pat)}
                              className="bg-slate-900 hover:bg-teal-800 font-extrabold text-xs py-2 px-4 rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 text-white !text-white border border-slate-800"
                              style={{ color: '#ffffff' }}
                            >
                              <Stethoscope className="w-3.5 h-3.5 text-teal-400" />
                              <span className="text-white font-bold">{pat.status === 'Paid & Waiting for Doctor' ? 'Open Diagnosis Chart' : 'View Chart'}</span>
                            </button>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            ) : (
               
              <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden animate-fade-in text-xs">
                <div className="bg-slate-900 text-white py-3.5 px-5 flex items-center justify-between flex-wrap gap-4 border-b-2 border-optm-goldenrod shadow-lg">
                  <div className="flex items-center space-x-3.5">
                    <button 
                      type="button"
                      onClick={() => {
                        if (isEditingChart) {
                          setShowDiscardConfirm(true);
                        } else {
                          setActiveConsultation(null);
                        }
                      }}
                      title="Return to Queue"
                      className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl transition-all cursor-pointer border border-white/20 shadow-2xs active:scale-95 flex items-center justify-center"
                    >
                      <ArrowLeft className="w-4 h-4 text-optm-goldenrod" />
                    </button>
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2.5">
                        <h2 className="text-sm font-black tracking-tight text-white capitalize">
                          {activeConsultation.firstName} {activeConsultation.lastName}
                        </h2>
                        {(() => {
                          const autoAge = calculateAgeFromDob(activeConsultation.dob) || activeConsultation.age;
                          return autoAge && (
                            <span className="text-[10px] font-extrabold text-slate-900 bg-optm-goldenrod px-2 py-0.5 rounded-md">
                              {activeConsultation.sex ? `${activeConsultation.sex} • ` : ''}{autoAge} yrs
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center space-x-2 flex-wrap text-[10.5px]">
                        <span className="font-mono font-extrabold text-emerald-400 bg-emerald-950 px-2 py-0.2 rounded border border-emerald-800">
                          {activeConsultation.regNo}
                        </span>
                        <span className="text-slate-400 font-bold">•</span>
                        <span className="text-slate-300 font-medium">Checked in: {activeConsultation.registrationDate}</span>
{activeConsultation.email && <><span className="text-slate-400 font-bold">•</span><span className="text-slate-300 font-medium">{activeConsultation.email}</span></>}
                        {activeConsultation.dob && (
                          <>
                            <span className="text-slate-400 font-bold">•</span>
                            <span className="text-slate-300 font-medium">
                              DOB: {activeConsultation.dob}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedPatientLogs(activeConsultation)}
                      className="px-3.5 py-1.5 rounded-xl text-[10.5px] font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-optm-goldenrod border border-slate-750 hover:border-optm-goldenrod/30 transition shadow-2xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-optm-goldenrod" />
                      <span>View Logs</span>
                    </button>
                    {activeConsultation?.isReadOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingChart) {
                            setShowDiscardConfirm(true);
                          } else {
                            setIsEditingChart(true);
                          }
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-[10.5px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                          isEditingChart 
                            ? 'bg-red-600 text-white hover:bg-red-700 border border-red-500' 
                            : 'bg-amber-400 text-slate-950 hover:bg-amber-300 border border-amber-300'
                        }`}
                      >
                        {isEditingChart ? (
                          <><span>✕</span><span>Cancel Edit</span></>
                        ) : (
                          <><span>✏️</span><span>Edit Details</span></>
                        )}
                      </button>
                    )}
                    <span className="bg-slate-800 text-slate-200 border border-slate-700 font-extrabold px-2.5 py-1.5 rounded-xl text-[10px] uppercase tracking-wider shadow-2xs flex items-center gap-1.5 shrink-0">
                      <span className={`w-2 h-2 rounded-full ${activeConsultation?.isReadOnly && !isEditingChart ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`}></span>
                      <span>{activeConsultation?.isReadOnly && !isEditingChart ? 'View Mode' : 'Active'}</span>
                    </span>
                  </div>
                </div>
                <div className="bg-optm-alabaster border-b border-optm-gray flex flex-wrap text-xs font-bold">
                  <button 
                    onClick={() => setDoctorTab('general')}
                    className={`px-4 py-2 transition border-b-2 flex items-center cursor-pointer ${doctorTab === 'general' ? 'border-optm-green bg-white text-optm-green' : 'border-transparent text-optm-green/60 hover:bg-optm-gray/20'}`}
                  >
                    <User className="w-3.5 h-3.5 mr-1" /> Form-I
                  </button>
                  <button 
                    onClick={() => setDoctorTab('parameters')}
                    className={`px-4 py-2 transition border-b-2 flex items-center cursor-pointer ${doctorTab === 'parameters' ? 'border-optm-green bg-white text-optm-green' : 'border-transparent text-optm-green/60 hover:bg-optm-gray/20'}`}
                  >
                    <Activity className="w-3.5 h-3.5 mr-1" /> Form-II
                  </button>
                  <button 
                    onClick={() => setDoctorTab('form3')}
                    className={`px-4 py-2 transition border-b-2 flex items-center cursor-pointer ${doctorTab === 'form3' ? 'border-optm-green bg-white text-optm-green' : 'border-transparent text-optm-green/60 hover:bg-optm-gray/20'}`}
                  >
                    <Activity className="w-3.5 h-3.5 mr-1" /> Form-III
                  </button>
                  <button 
                    onClick={() => setDoctorTab('diagnosis')}
                    className={`px-4 py-2 transition border-b-2 flex items-center cursor-pointer ${doctorTab === 'diagnosis' ? 'border-optm-green bg-white text-optm-green' : 'border-transparent text-optm-green/60 hover:bg-optm-gray/20'}`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5 mr-1" /> Provisional Diagnosis
                  </button>
                  <button 
                    onClick={() => setDoctorTab('packages')}
                    className={`px-4 py-2 transition border-b-2 flex items-center cursor-pointer ${doctorTab === 'packages' ? 'border-optm-green bg-white text-optm-green' : 'border-transparent text-optm-green/60 hover:bg-optm-gray/20'}`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5 mr-1" /> Prescribed Packages
                  </button>
                </div>
                <div className="p-3 md:p-4 pt-0 mt-0 space-y-3 max-h-[60vh] overflow-y-auto">
  <fieldset 
    disabled={activeConsultation?.isReadOnly && !isEditingChart} 
    className="space-y-3 border-0 p-0 m-0 min-w-0 disabled:opacity-80 transition-opacity duration-300"
  >
                  {doctorTab === 'general' && (
                    <div className="space-y-4 w-full">
                      <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white shadow-sm">
                        <span className="block font-black text-red-700 border-b pb-1 text-[9px] uppercase tracking-wider">
                          IDENTIFICATION OF FACTORS THAT PERCIPITATE PAIN:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {[
                            'Changing weather', 'Fatigue Movement/Overuse', 'Stress', 'Hormonal Changes',
                            'Cold', 'Heat', 'Humidity', 'Static Position', 'Allergy', 'Others'
                          ].map(factor => {
                            const fKey = factor.toLowerCase().replace(/[^a-z]/g, '');
                            return (
                              <label key={factor} className="flex items-center space-x-1.5 cursor-pointer py-0.5">
                                <input 
                                  type="checkbox"
                                  className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-3 h-3"
                                  checked={examForm.precipitatingFactors?.[fKey] || false}
                                  onChange={e => {
                                    const updated = { ...(examForm.precipitatingFactors || {}), [fKey]: e.target.checked };
                                    setExamForm({ ...examForm, precipitatingFactors: updated });
                                  }}
                                />
                                <span className="font-medium text-slate-800 text-[10px]">{factor}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                        <span className="font-black text-red-700 uppercase tracking-wider text-[9px]">
                          DO EMOTIONS CONTRIBUTE TO THE SEVERITY OF SYMPTOMS AND FUNCTIONAL LIMITATIONS?:
                        </span>
                        <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                          {['Yes', 'No'].map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setExamForm({...examForm, emotionsContribute: opt})}
                              className={`px-3 py-1 rounded-md text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                                (examForm.emotionsContribute || 'No') === opt
                                  ? 'bg-optm-green text-white shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white shadow-sm">
                        <span className="block font-black text-red-700 border-b pb-1 text-[9px] uppercase tracking-wider">
                          ASSOCIATED MANIFESTATIONS / MULTIPLE COMPLAINTS / COMORBIDITIES:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {[
                            'Sweating', 'Nausea', 'Vomiting', 'Acidity', 'Reflux', 'Dizziness', 'Anaemia', 'Insomnia',
                            'Tiredness', 'Fatigue', 'Depression', 'Anxiety', 'Muscle wasting', 'Weight loss', 'Weight gain',
                            'Appetite loss', 'Indigestion', 'Constipation', 'Varicose vein', 'Urinary Incontinence',
                            'Dysmenorrhea', 'Leucorrhoea', 'Skin allergy', 'Crepitus during knee flexion', 'Morning stiffness (<30 minute)'
                          ].map(manifest => {
                            const mKey = manifest.toLowerCase().replace(/[^a-z]/g, '');
                            return (
                              <label key={manifest} className="flex items-center space-x-1.5 cursor-pointer py-0.5">
                                <input 
                                  type="checkbox"
                                  className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-3 h-3"
                                  checked={examForm.manifestations?.[mKey] || false}
                                  onChange={e => {
                                    const updated = { ...(examForm.manifestations || {}), [mKey]: e.target.checked };
                                    setExamForm({ ...examForm, manifestations: updated });
                                  }}
                                />
                                <span className="font-medium text-slate-800 text-[10px]">{manifest}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white shadow-sm text-xs">
                        <span className="block font-black text-red-700 border-b pb-1 text-[9px] uppercase tracking-wider">
                          PAST MEDICAL HISTORY:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <div className="sm:col-span-5">
                            <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">Major Adult Illness</label>
                            <input 
                              type="text" 
                              placeholder="Illness details..."
                              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-900 outline-none focus:ring-1 focus:ring-optm-green"
                              value={examForm.pastMajorIllness || ''}
                              onChange={e => setExamForm({...examForm, pastMajorIllness: e.target.value})}
                            />
                          </div>
                          <div className="sm:col-span-4">
                            <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">a) Surgical Intervention</label>
                            <input 
                              type="text" 
                              placeholder="Surgery details..."
                              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-900 outline-none focus:ring-1 focus:ring-optm-green"
                              value={examForm.pastOperations || ''}
                              onChange={e => setExamForm({...examForm, pastOperations: e.target.value})}
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[8px] font-bold text-slate-500 uppercase mb-0.5">b) Pacemaker</label>
                            <div className="flex bg-slate-50 rounded border border-slate-200 p-0.5 items-center justify-between h-[27px]">
                              <span className="text-[9px] font-bold text-slate-600 pl-1">Use:</span>
                              <div className="flex space-x-1">
                                {['YES', 'NO'].map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setExamForm({...examForm, usingPacemaker: opt})}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition ${
                                      (examForm.usingPacemaker || 'No').toUpperCase() === opt 
                                        ? 'bg-optm-green text-white shadow-xs' 
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {examForm.sex === 'Female' && (
                        <div className="border border-pink-200 bg-pink-50/20 rounded-xl p-3 space-y-2 animate-fade-in shadow-sm">
                          <span className="block font-black text-pink-900 border-b border-pink-200 pb-1 text-[9px] uppercase tracking-wider">
                            FEMALE REPRODUCTIVE SYSTEM:
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            <div>
                              <label className="block text-[8px] font-bold text-slate-600 mb-0.5">i) Status of Uterus</label>
                              <input 
                                type="text" placeholder="Status" className="w-full bg-white border border-slate-200 rounded p-1 text-xs"
                                value={examForm.femaleReproductive?.uterus || ''}
                                onChange={e => setExamForm({...examForm, femaleReproductive: {...examForm.femaleReproductive, uterus: e.target.value}})}
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-slate-600 mb-0.5">ii) Status of Ovary</label>
                              <input 
                                type="text" placeholder="Status" className="w-full bg-white border border-slate-200 rounded p-1 text-xs"
                                value={examForm.femaleReproductive?.ovary || ''}
                                onChange={e => setExamForm({...examForm, femaleReproductive: {...examForm.femaleReproductive, ovary: e.target.value}})}
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-slate-600 mb-0.5">iii) Menarche at the age of</label>
                              <input 
                                type="text" placeholder="Age" className="w-full bg-white border border-slate-200 rounded p-1 text-xs"
                                value={examForm.femaleReproductive?.menarcheAge || ''}
                                onChange={e => setExamForm({...examForm, femaleReproductive: {...examForm.femaleReproductive, menarcheAge: e.target.value}})}
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-slate-600 mb-0.5">iv) Menstruation cycle</label>
                              <input 
                                type="text" placeholder="Cycle days" className="w-full bg-white border border-slate-200 rounded p-1 text-xs"
                                value={examForm.femaleReproductive?.cycle || ''}
                                onChange={e => setExamForm({...examForm, femaleReproductive: {...examForm.femaleReproductive, cycle: e.target.value}})}
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-slate-600 mb-0.5">v) Flow: Normal / Abnormal / Heavy</label>
                              <div className="grid grid-cols-3 gap-1 bg-white p-0.5 rounded border border-slate-200 shadow-2xs">
                                {[
                                  { label: 'Normal', code: 'N' },
                                  { label: 'Abnormal', code: 'A' },
                                  { label: 'Heavy', code: 'H' }
                                ].map(item => {
                                  const isSelected = examForm.femaleReproductive?.flow === item.label || examForm.femaleReproductive?.flow === item.code;
                                  return (
                                    <button
                                      key={item.label}
                                      type="button"
                                      onClick={() => setExamForm({
                                        ...examForm, 
                                        femaleReproductive: { ...examForm.femaleReproductive, flow: item.label }
                                      })}
                                      className={`py-1 rounded text-[9px] font-extrabold uppercase transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                                        isSelected 
                                          ? 'bg-optm-green text-white shadow-xs scale-[0.98]' 
                                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-150'
                                      }`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-optm-goldenrod animate-pulse' : 'bg-slate-400'}`}></span>
                                      <span>{item.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-slate-600 mb-0.5">vi) Menopause at the age of</label>
                              <input 
                                type="text" placeholder="Age" className="w-full bg-white border border-slate-200 rounded p-1 text-xs"
                                value={examForm.femaleReproductive?.menopauseAge || ''}
                                onChange={e => setExamForm({...examForm, femaleReproductive: {...examForm.femaleReproductive, menopauseAge: e.target.value}})}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white shadow-sm">
                        <span className="block font-black text-red-700 border-b pb-1 text-[9px] uppercase tracking-wider">
                          DIETARY HABITS AND OTHER HABITS:
                        </span>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
                          {['Vegetarian', 'Non-vegetarian', 'Excessive drink of Tea', 'Excessive drink of Coffee', 'Smoking', 'Drinking Alcohol', 'Chewing tobacco', 'Free from other habit'].map(habit => {
                            const hKey = habit.toLowerCase().replace(/[^a-z]/g, '');
                            const isChecked = habit.includes('Vegetarian') ? examForm.physicalExams?.foodHabit === (habit.includes('Non') ? 'NonVeg' : 'Veg') : examForm.otherHabits?.[hKey] || false;
                            return (
                              <label key={habit} className="flex items-center space-x-1.5 cursor-pointer">
                                <input 
                                  type="checkbox"
                                  className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-3 h-3"
                                  checked={isChecked}
                                  onChange={e => {
                                    if (habit.includes('Vegetarian')) {
                                      setExamForm({
                                        ...examForm,
                                        physicalExams: { ...examForm.physicalExams, foodHabit: habit.includes('Non') ? 'NonVeg' : 'Veg' }
                                      });
                                    } else {
                                      const updated = { ...(examForm.otherHabits || {}), [hKey]: e.target.checked };
                                      setExamForm({ ...examForm, otherHabits: updated });
                                    }
                                  }}
                                />
                                <span className="font-medium text-slate-800 text-[10px]">{habit}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white shadow-sm text-xs">
                        <span className="block font-black text-red-700 border-b pb-1 text-[9px] uppercase tracking-wider">
                          MEASURES TAKEN TO DIMINISH PAIN:
                        </span>
                        <div className="space-y-2">
                          {[
                            { label: 'Using Knee braced', hasSides: true },
                            { label: 'Using lumbar belt' },
                            { label: 'Using Collar belt' },
                            { label: 'Using stick/ walker' },
                            { label: 'Using Paracetamol and NSAID', hasFrequency: true },
                            { label: 'Undergone Arthrocentesis' },
                            { label: 'Use of Hyaluronic acid' },
                            { label: 'Use of Corticosteroid injection' },
                            { label: 'Ayurveda Treatment' },
                            { label: 'Homeopathic treatment' },
                            { label: 'Massage with herbal or other gels' }
                          ].map((item, idx) => {
                            const measureKey = item.label.toLowerCase().replace(/[^a-z]/g, '');
                            const currentVal = examForm.measuresTaken?.[measureKey]?.status || 'NO';
                            return (
                              <div key={idx} className="py-1.5 border-b border-slate-100 last:border-0 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-slate-800 text-[11px]">{item.label}</span>
                                  <div className="flex items-center space-x-4">
                                    {['NO', 'YES'].map(opt => (
                                      <label key={opt} className="flex items-center space-x-1 cursor-pointer">
                                        <input 
                                          type="radio"
                                          name={`measure_${idx}`}
                                          checked={currentVal === opt}
                                          onChange={() => {
                                            const updated = { ...(examForm.measuresTaken || {}) };
                                            updated[measureKey] = { ...(updated[measureKey] || {}), status: opt };
                                            setExamForm({ ...examForm, measuresTaken: updated });
                                          }}
                                          className="text-optm-green focus:ring-optm-green w-3 h-3 cursor-pointer"
                                        />
                                        <span className="font-bold text-slate-800 text-[10px]">{opt}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                {item.hasSides && currentVal === 'YES' && (
                                  <div className="flex items-center space-x-4 pl-4 pt-0.5 animate-fade-in text-[10px]">
                                    <span className="font-bold text-slate-500">Side:</span>
                                    {['Right knee', 'Left knee', 'Bilateral'].map(side => (
                                      <label key={side} className="flex items-center space-x-1 cursor-pointer">
                                        <input 
                                          type="radio"
                                          name={`measure_${idx}_side`}
                                          checked={examForm.measuresTaken?.[measureKey]?.side === side}
                                          onChange={() => {
                                            const updated = { ...(examForm.measuresTaken || {}) };
                                            updated[measureKey] = { ...updated[measureKey], side };
                                            setExamForm({ ...examForm, measuresTaken: updated });
                                          }}
                                          className="text-optm-green w-2.5 h-2.5 cursor-pointer"
                                        />
                                        <span className="font-medium text-slate-700">{side}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                                {item.hasFrequency && currentVal === 'YES' && (
                                  <div className="flex items-center space-x-4 pl-4 pt-0.5 animate-fade-in text-[10px]">
                                    <span className="font-bold text-slate-500">Frequency:</span>
                                    {['Daily', 'SOS'].map(freq => (
                                      <label key={freq} className="flex items-center space-x-1 cursor-pointer">
                                        <input 
                                          type="radio"
                                          name={`measure_${idx}_freq`}
                                          checked={examForm.measuresTaken?.[measureKey]?.frequency === freq}
                                          onChange={() => {
                                            const updated = { ...(examForm.measuresTaken || {}) };
                                            updated[measureKey] = { ...updated[measureKey], frequency: freq };
                                            setExamForm({ ...examForm, measuresTaken: updated });
                                          }}
                                          className="text-optm-green w-2.5 h-2.5 cursor-pointer"
                                        />
                                        <span className="font-medium text-slate-700">{freq}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white shadow-sm text-xs">
                        <span className="block font-black text-red-700 border-b pb-1 text-[9px] uppercase tracking-wider">
                          SUPPLIMENTS TAKEN TO REDUCE PAIN OR IMPROVE FITNESS:
                        </span>
                        <div className="space-y-1.5">
                          {['Calcium', 'Vitamin D', 'Glucosamine', 'Glucosamine and Chondroitin'].map((supp, idx) => {
                            const suppKey = supp.toLowerCase().replace(/[^a-z]/g, '');
                            const currentVal = examForm.supplementsTaken?.[suppKey] || 'NO';
                            return (
                              <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                                <span className="font-semibold text-slate-800 text-[11px]">{supp}</span>
                                <div className="flex items-center space-x-4">
                                  {['NO', 'YES'].map(opt => (
                                    <label key={opt} className="flex items-center space-x-1 cursor-pointer">
                                      <input 
                                        type="radio"
                                        name={`supp_${idx}`}
                                        checked={currentVal === opt}
                                        onChange={() => {
                                          const updated = { ...(examForm.supplementsTaken || {}) };
                                          updated[suppKey] = opt;
                                          setExamForm({ ...examForm, supplementsTaken: updated });
                                        }}
                                        className="text-optm-green focus:ring-optm-green w-3 h-3 cursor-pointer"
                                      />
                                      <span className="font-bold text-slate-800 text-[10px]">{opt}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="border border-slate-200 rounded-xl p-3 space-y-3 bg-white shadow-sm text-xs">
                        <span className="block font-black text-red-700 border-b pb-1 text-[9px] uppercase tracking-wider">
                          SURGICAL INTERVENTION:
                        </span>
                        <div className="space-y-3">
                          <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-150">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-slate-800 text-[11px]">Knee joint: (Total knee replacement):</span>
                              <div className="flex items-center space-x-3">
                                {['Right', 'Left', 'Bilateral'].map(opt => (
                                  <label key={opt} className="flex items-center space-x-1 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={examForm.surgicalIntervention?.kneeTotal?.[opt.toLowerCase()] || false}
                                      onChange={e => {
                                        const updated = { ...(examForm.surgicalIntervention || {}) };
                                        updated.kneeTotal = { ...(updated.kneeTotal || {}), [opt.toLowerCase()]: e.target.checked };
                                        setExamForm({ ...examForm, surgicalIntervention: updated });
                                      }}
                                      className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-3 h-3" 
                                    />
                                    <span className="font-medium text-slate-700 text-[10px]">{opt}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-1">
                              <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Undergone on:</span>
                              <input 
                                type="text" 
                                placeholder="Date / Year" 
                                className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[10.5px] font-medium outline-none focus:ring-1 focus:ring-optm-green"
                                value={examForm.surgicalIntervention?.kneeTotalDate || ''}
                                onChange={e => {
                                  const updated = { ...(examForm.surgicalIntervention || {}), kneeTotalDate: e.target.value };
                                  setExamForm({ ...examForm, surgicalIntervention: updated });
                                }}
                              />
                            </div>
                          </div>
                          <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-150">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-slate-800 text-[11px] pl-4">(Arthrocentesis):</span>
                              <div className="flex items-center space-x-3">
                                {['Right', 'Left', 'Bilateral'].map(opt => (
                                  <label key={opt} className="flex items-center space-x-1 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={examForm.surgicalIntervention?.arthrocentesis?.[opt.toLowerCase()] || false}
                                      onChange={e => {
                                        const updated = { ...(examForm.surgicalIntervention || {}) };
                                        updated.arthrocentesis = { ...(updated.arthrocentesis || {}), [opt.toLowerCase()]: e.target.checked };
                                        setExamForm({ ...examForm, surgicalIntervention: updated });
                                      }}
                                      className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-3 h-3" 
                                    />
                                    <span className="font-medium text-slate-700 text-[10px]">{opt}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-1">
                              <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap pl-4">Undergone on:</span>
                              <input 
                                type="text" 
                                placeholder="Date / Year" 
                                className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[10.5px] font-medium outline-none focus:ring-1 focus:ring-optm-green"
                                value={examForm.surgicalIntervention?.arthrocentesisDate || ''}
                                onChange={e => {
                                  const updated = { ...(examForm.surgicalIntervention || {}), arthrocentesisDate: e.target.value };
                                  setExamForm({ ...examForm, surgicalIntervention: updated });
                                }}
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-150">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-slate-800 text-[11px]">Lumber region:</span>
                              <div className="flex flex-wrap gap-3">
                                {[
                                  { key: 'laminectomy', label: 'Laminectomy (spinal decompression)' },
                                  { key: 'fusion', label: 'Spinal fusion' },
                                  { key: 'discReplacement', label: 'Artificial disk replacement' }
                                ].map(item => (
                                  <label key={item.key} className="flex items-center space-x-1 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={examForm.surgicalIntervention?.lumber?.[item.key] || false}
                                      onChange={e => {
                                        const updated = { ...(examForm.surgicalIntervention || {}) };
                                        updated.lumber = { ...(updated.lumber || {}), [item.key]: e.target.checked };
                                        setExamForm({ ...examForm, surgicalIntervention: updated });
                                      }}
                                      className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-3 h-3" 
                                    />
                                    <span className="font-medium text-slate-700 text-[10px]">{item.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-1">
                              <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Undergone on:</span>
                              <input 
                                type="text" 
                                placeholder="Date / Year" 
                                className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[10.5px] font-medium outline-none focus:ring-1 focus:ring-optm-green"
                                value={examForm.surgicalIntervention?.lumberDate || ''}
                                onChange={e => {
                                  const updated = { ...(examForm.surgicalIntervention || {}), lumberDate: e.target.value };
                                  setExamForm({ ...examForm, surgicalIntervention: updated });
                                }}
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-150">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-slate-800 text-[11px]">Cervical region:</span>
                              <div className="flex flex-wrap gap-3">
                                {[
                                  { key: 'laminoplasty', label: 'Laminoplasty' },
                                  { key: 'laminectomy', label: 'laminectomy' },
                                  { key: 'discReplacement', label: 'Artificial disc replacement' }
                                ].map(item => (
                                  <label key={item.key} className="flex items-center space-x-1 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={examForm.surgicalIntervention?.cervical?.[item.key] || false}
                                      onChange={e => {
                                        const updated = { ...(examForm.surgicalIntervention || {}) };
                                        updated.cervical = { ...(updated.cervical || {}), [item.key]: e.target.checked };
                                        setExamForm({ ...examForm, surgicalIntervention: updated });
                                      }}
                                      className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-3 h-3" 
                                    />
                                    <span className="font-medium text-slate-700 text-[10px]">{item.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-1">
                              <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Undergone on:</span>
                              <input 
                                type="text" 
                                placeholder="Date / Year" 
                                className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[10.5px] font-medium outline-none focus:ring-1 focus:ring-optm-green"
                                value={examForm.surgicalIntervention?.cervicalDate || ''}
                                onChange={e => {
                                  const updated = { ...(examForm.surgicalIntervention || {}), cervicalDate: e.target.value };
                                  setExamForm({ ...examForm, surgicalIntervention: updated });
                                }}
                              />
                            </div>
                          </div>
                          <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-150 text-xs">
                            <span className="font-bold text-slate-800 text-[11px] block">Bypass surgery:</span>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-start gap-2 pl-2">
                              <span className="text-[10px] font-medium text-slate-700 whitespace-nowrap">Coronary artery bypass graft (CABG). Undergone on:</span>
                              <input 
                                type="text" 
                                placeholder="DD/MM/YYYY or Year" 
                                className="w-full sm:w-56 bg-white border border-slate-200 rounded px-2 py-0.5 text-[10.5px] font-medium outline-none focus:ring-1 focus:ring-optm-green text-left"
                                value={examForm.surgicalIntervention?.bypassDate || ''}
                                onChange={e => {
                                  const updated = { ...(examForm.surgicalIntervention || {}), bypassDate: e.target.value };
                                  setExamForm({ ...examForm, surgicalIntervention: updated });
                                }}
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-150">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-slate-800 text-[11px]">Varicose vein:</span>
                              <div className="flex flex-wrap gap-3">
                                {[
                                  { key: 'ablation', label: 'Venous ablation' },
                                  { key: 'phlebectomy', label: 'Phlebectomy' },
                                  { key: 'other', label: 'other methods' }
                                ].map(item => (
                                  <label key={item.key} className="flex items-center space-x-1 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={examForm.surgicalIntervention?.varicose?.[item.key] || false}
                                      onChange={e => {
                                        const updated = { ...(examForm.surgicalIntervention || {}) };
                                        updated.varicose = { ...(updated.varicose || {}), [item.key]: e.target.checked };
                                        setExamForm({ ...examForm, surgicalIntervention: updated });
                                      }}
                                      className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-3 h-3" 
                                    />
                                    <span className="font-medium text-slate-700 text-[10px]">{item.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-1">
                              <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Undergone on:</span>
                              <input 
                                type="text" 
                                placeholder="Date / Year" 
                                className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[10.5px] font-medium outline-none focus:ring-1 focus:ring-optm-green"
                                value={examForm.surgicalIntervention?.varicoseDate || ''}
                                onChange={e => {
                                  const updated = { ...(examForm.surgicalIntervention || {}), varicoseDate: e.target.value };
                                  setExamForm({ ...examForm, surgicalIntervention: updated });
                                }}
                              />
                            </div>
                          </div>
                          <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-150">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-slate-800 text-[11px]">Carpal Tunnel: (Endoscopic carpal tunnel release):</span>
                              <div className="flex items-center space-x-3">
                                {['Right Hand', 'Left Hand', 'Bilateral'].map(opt => (
                                  <label key={opt} className="flex items-center space-x-1 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={examForm.surgicalIntervention?.carpal?.[opt.toLowerCase().replace(' hand', '')] || false}
                                      onChange={e => {
                                        const k = opt.toLowerCase().replace(' hand', '');
                                        const updated = { ...(examForm.surgicalIntervention || {}) };
                                        updated.carpal = { ...(updated.carpal || {}), [k]: e.target.checked };
                                        setExamForm({ ...examForm, surgicalIntervention: updated });
                                      }}
                                      className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-3 h-3" 
                                    />
                                    <span className="font-medium text-slate-700 text-[10px]">{opt}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-1">
                              <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Undergone on:</span>
                              <input 
                                type="text" 
                                placeholder="Date / Year" 
                                className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-[10.5px] font-medium outline-none focus:ring-1 focus:ring-optm-green"
                                value={examForm.surgicalIntervention?.carpalDate || ''}
                                onChange={e => {
                                  const updated = { ...(examForm.surgicalIntervention || {}), carpalDate: e.target.value };
                                  setExamForm({ ...examForm, surgicalIntervention: updated });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white shadow-sm">
                        <span className="block font-black text-red-700 border-b pb-1 text-[9px] uppercase tracking-wider">
                          PRESENT HISTORY:
                        </span>
                        <textarea 
                          rows="3"
                          placeholder="Enter detailed present history notes..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 outline-none focus:ring-1 focus:ring-optm-green"
                          value={examForm.periodOfSuffering || ''}
                          onChange={e => setExamForm({...examForm, periodOfSuffering: e.target.value})}
                        ></textarea>
                      </div>
                      <div className="border border-slate-200 bg-amber-50/20 rounded-xl p-3.5 space-y-3 shadow-sm">
                        <span className="block font-black text-red-700 border-b pb-1 text-[9px] uppercase tracking-wider">
                          DECLARATION / CONSENT:
                        </span>
                        <label className="flex items-start space-x-2.5 cursor-pointer">
                          <input 
                            type="checkbox"
                            className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-4 h-4 mt-0.5"
                            checked={examForm.consentGiven || false}
                            onChange={e => setExamForm({...examForm, consentGiven: e.target.checked})}
                          />
                          <span className="text-[11px] text-slate-700 leading-relaxed font-medium">
                            I hereby voluntarily given my consent for thorough Physical examinations of my body, blood samples collection, and Spine and Knee joints images (either X-ray or CT-scan or MRI) or Extraction of fluids from knee joints required for future studies.
                          </span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          <div className="bg-white p-2 rounded-lg border border-slate-200 space-y-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Signature of Patient</span>
                            <input 
                              type="text" 
                              placeholder="Type patient name to sign" 
                              className="w-full border-b border-dashed border-slate-300 bg-transparent font-serif italic text-xs text-slate-800 py-1 px-1 outline-none"
                              value={examForm.patientSignature || ''}
                              onChange={e => setExamForm({...examForm, patientSignature: e.target.value})}
                            />
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-200 space-y-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Signature of Patient's Party</span>
                            <input 
                              type="text" 
                              placeholder="Type party name to sign" 
                              className="w-full border-b border-dashed border-slate-300 bg-transparent font-serif italic text-xs text-slate-800 py-1 px-1 outline-none"
                              value={examForm.patientPartySignature || ''}
                              onChange={e => setExamForm({...examForm, patientPartySignature: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {doctorTab === 'parameters' && (
                    <div className="space-y-4 w-full">
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
                        <div className="border-b pb-2">
                          <span className="font-black text-red-700 text-[11px] uppercase tracking-wider block">
                            PART-A: PAIN SENSATION (GANGULY-SCALE):
                          </span>
                        </div>
                        <div className="overflow-x-auto border border-slate-200 rounded-lg">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-700 uppercase">
                              <tr>
                                <th colSpan="2" className="p-2 border-r text-center">Knee Joint</th>
                                <th className="p-2 border-r text-center">Lumber Region</th>
                                <th className="p-2 border-r text-center">Cervical Region</th>
                                <th className="p-2 border-r text-center">Heel Region</th>
                                <th className="p-2 text-slate-600 font-medium normal-case leading-relaxed">
                                  A= Extremely; B= Very much; C= Moderate; D= Slight; E= Not reported
                                </th>
                              </tr>
                              <tr className="border-t border-slate-200 bg-white text-[10px]">
                  <th className="p-1.5 border-r text-center text-slate-600 font-semibold w-[12%]">Right</th>
                  <th className="p-1.5 border-r text-center text-slate-600 font-semibold w-[12%]">Left</th>
                  <th className="p-1.5 border-r text-center text-slate-600 font-semibold w-[15%]">Rating</th>
                  <th className="p-1.5 border-r text-center text-slate-600 font-semibold w-[15%]">Rating</th>
                  <th className="p-1.5 border-r text-center text-slate-600 font-semibold w-[15%]">Rating</th>
                  <th className="p-1.5 text-slate-400 w-[31%]"></th>
                </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="p-1.5 border-r">
                                  <select 
                                    className="w-full border rounded p-1 bg-white font-medium text-center text-xs"
                                    value={examForm.params.painSensationKneeRt || ''}
                                    onChange={e => setExamForm({...examForm, params: {...examForm.params, painSensationKneeRt: e.target.value}})}
                                  >
                                    <option value="">-</option>
                                    {['A','B','C','D','E'].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </td>
                                <td className="p-1.5 border-r">
                                  <select 
                                    className="w-full border rounded p-1 bg-white font-medium text-center text-xs"
                                    value={examForm.params.painSensationKneeLt || ''}
                                    onChange={e => setExamForm({...examForm, params: {...examForm.params, painSensationKneeLt: e.target.value}})}
                                  >
                                    <option value="">-</option>
                                    {['A','B','C','D','E'].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </td>
                                <td className="p-1.5 border-r">
                                  <select 
                                    className="w-full border rounded p-1 bg-white font-medium text-center text-xs"
                                    value={examForm.params.painSensationLumber || ''}
                                    onChange={e => setExamForm({...examForm, params: {...examForm.params, painSensationLumber: e.target.value}})}
                                  >
                                    <option value="">-</option>
                                    {['A','B','C','D','E'].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </td>
                                <td className="p-1.5 border-r">
                                  <select 
                                    className="w-full border rounded p-1 bg-white font-medium text-center text-xs"
                                    value={examForm.params.painSensationCervical || ''}
                                    onChange={e => setExamForm({...examForm, params: {...examForm.params, painSensationCervical: e.target.value}})}
                                  >
                                    <option value="">-</option>
                                    {['A','B','C','D','E'].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </td>
                                <td className="p-1.5 border-r">
                                  <select 
                                    className="w-full border rounded p-1 bg-white font-medium text-center text-xs"
                                    value={examForm.params.painSensationHeel || ''}
                                    onChange={e => setExamForm({...examForm, params: {...examForm.params, painSensationHeel: e.target.value}})}
                                  >
                                    <option value="">-</option>
                                    {['A','B','C','D','E'].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </td>
                                <td className="p-1.5 text-slate-400 text-[10px] italic">Ganguly-Scale Rating Entry</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="space-y-3 pt-3 border-t">
                          <div className="space-y-1">
                            <span className="font-black text-red-700 text-[11px] uppercase tracking-wider block">
                              PART-B: THE WESTERN ONTARIO AND MCMASTER UNIVERSITIES OSTEOARTHRITIS INDEX (WOMAC)-SCALE
                            </span>
                            <p className="text-[10px] text-red-600 italic font-medium">
                              (NOTE: The examiner will fill up all the questions from the data of KOOS scale. No need of asking any question to the concerned patient. The scale will strengthen the pain parameter so examined)
                            </p>
                            <p className="text-[10px] text-slate-600 font-bold">
                              The WOMAC consists of 24 items divided into 3 subscales: • Pain (5 items): • Stiffness (2 items): • Physical Function (17 items)
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <h5 className="font-bold text-red-700 text-[10.5px] uppercase">
                              I. PAIN (RANGE: 0-20): <span className="font-normal text-slate-500 lowercase">(Answer these questions thinking of the knee symptoms during the last 48 Hours)</span>
                            </h5>
                            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-700 uppercase text-center">
                                  <tr>
                                    <th className="p-2 border-r w-14 text-center">SNo.</th>
                                    <th className="p-2 border-r text-left">Particulars</th>
                                    <th className="p-2 border-r w-16">None (+0)</th>
                                    <th className="p-2 border-r w-16">Mild (+1)</th>
                                    <th className="p-2 border-r w-16">Moderate (+2)</th>
                                    <th className="p-2 border-r w-16">Severe (+3)</th>
                                    <th className="p-2 border-r w-16">Extreme (+4)</th>
                                    <th className="p-2 border-r w-20">Score earned</th>
                                    <th className="p-2 w-16">KOOS items #</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                                  {[
                                    { no: '01', text: 'When walking in a flat surface?', ko: 'P5', key: 'womac_p1' },
                                    { no: '02', text: 'When going up or down stairs?', ko: 'P6', key: 'womac_p2' },
                                    { no: '03', text: 'At night while in bed?', ko: 'P7', key: 'womac_p3' },
                                    { no: '04', text: 'While sitting or lying down?', ko: 'P8', key: 'womac_p4' },
                                    { no: '05', text: 'While standing?', ko: 'P9', key: 'womac_p5' }
                                  ].map((row) => (
                                    <tr key={row.key}>
                                      <td className="p-2 border-r text-center font-bold text-slate-600">{row.no}</td>
                                      <td className="p-2 border-r text-slate-800">{row.text}</td>
                                      {[0, 1, 2, 3, 4].map((scoreVal) => (
                                        <td key={scoreVal} className="p-1 border-r text-center">
                                          <input 
                                            type="radio" 
                                            name={row.key}
                                            checked={parseInt(examForm.params?.[row.key] ?? '-1') === scoreVal}
                                            onChange={() => setExamForm({
                                              ...examForm, 
                                              params: { ...examForm.params, [row.key]: scoreVal }
                                            })}
                                            className="text-optm-green focus:ring-optm-green w-3.5 h-3.5 cursor-pointer"
                                          />
                                        </td>
                                      ))}
                                      <td className="p-2 border-r text-center font-bold text-optm-green">
                                        {examForm.params?.[row.key] ?? '-'}
                                      </td>
                                      <td className="p-2 text-center text-slate-500 font-mono">{row.ko}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {(() => {
                              const painTotal = ['womac_p1','womac_p2','womac_p3','womac_p4','womac_p5'].reduce((acc, k) => acc + (parseInt(examForm.params?.[k]) || 0), 0);
                              const painPercent = ((painTotal / 20) * 100).toFixed(1);
                              return (
                                <div className="flex justify-between items-center text-[10.5px] font-bold text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                                  <span>% of PAIN = Total Score earned/20 x100 = <strong className="text-optm-green font-mono">{painPercent}%</strong></span>
                                  <span>Total Score earned: <strong className="text-optm-green font-mono text-xs">{painTotal} / 20</strong></span>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="space-y-1.5 pt-2">
                            <h5 className="font-bold text-red-700 text-[10.5px] uppercase">
                              II. STIFFNESS (RANGE: 0-8): <span className="font-normal text-slate-500 lowercase">(Answer these questions thinking of the knee symptoms during the last 48 Hours)</span>
                            </h5>
                            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-700 uppercase text-center">
                                  <tr>
                                    <th className="p-2 border-r w-14 whitespace-nowrap text-center">SNO.</th>
                                    <th className="p-2 border-r text-left">PARTICULARS</th>
                                    <th className="p-2 border-r w-14">None (+0)</th>
                                    <th className="p-2 border-r w-14">Mild (+1)</th>
                                    <th className="p-2 border-r w-14">Moderate (+2)</th>
                                    <th className="p-2 border-r w-14">Severe (+3)</th>
                                    <th className="p-2 border-r w-14">Extreme (+4)</th>
                                    <th className="p-2 border-r w-16">Score earned</th>
                                    <th className="p-2 w-14">KOOS items #</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                                  {[
                                    { no: '06', text: 'How severe has your stiffness been after you first woke up in the morning?', ko: 'S6', key: 'womac_s1' },
                                    { no: '07', text: 'How severe has your stiffness been after sitting or lying down or while resting later in the day?', ko: 'S7', key: 'womac_s2' }
                                  ].map((row) => (
                                    <tr key={row.key}>
                                      <td className="p-2 border-r text-center font-bold text-slate-600">{row.no}</td>
                                      <td className="p-2 border-r text-slate-800">{row.text}</td>
                                      {[0, 1, 2, 3, 4].map((scoreVal) => (
                                        <td key={scoreVal} className="p-1 border-r text-center">
                                          <input 
                                            type="radio" 
                                            name={row.key}
                                            checked={parseInt(examForm.params?.[row.key] ?? '-1') === scoreVal}
                                            onChange={() => setExamForm({
                                              ...examForm, 
                                              params: { ...examForm.params, [row.key]: scoreVal }
                                            })}
                                            className="text-optm-green focus:ring-optm-green w-3.5 h-3.5 cursor-pointer"
                                          />
                                        </td>
                                      ))}
                                      <td className="p-2 border-r text-center font-bold text-optm-green">
                                        {examForm.params?.[row.key] ?? '-'}
                                      </td>
                                      <td className="p-2 text-center text-slate-500 font-mono">{row.ko}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {(() => {
                              const stiffnessTotal = ['womac_s1','womac_s2'].reduce((acc, k) => acc + (parseInt(examForm.params?.[k]) || 0), 0);
                              const stiffnessPercent = ((stiffnessTotal / 8) * 100).toFixed(1);
                              return (
                                <div className="flex justify-between items-center text-[10.5px] font-bold text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                                  <span>% of STIFNESS = Total Score earned/8 x100 = <strong className="text-optm-green font-mono">{stiffnessPercent}%</strong></span>
                                  <span>Total Score earned: <strong className="text-optm-green font-mono text-xs">{stiffnessTotal} / 8</strong></span>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="space-y-1.5 pt-3">
                            <h5 className="font-bold text-red-700 text-[10.5px] uppercase">
                              III. DIFFICULTY PERFORMING DAILY ACTIVITIES (RANGE: 0-68): <span className="font-normal text-slate-500 lowercase">(Answer these questions thinking of the knee symptoms during the last 48 Hours)</span>
                            </h5>
                            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-700 uppercase text-center">
                                  <tr>
                                    <th className="p-2 border-r w-14 whitespace-nowrap text-center">SNO.</th>
                                    <th className="p-2 border-r text-left">PARTICULARS</th>
                                    <th className="p-2 border-r w-14">None (+0)</th>
                                    <th className="p-2 border-r w-14">Mild (+1)</th>
                                    <th className="p-2 border-r w-14">Moderate (+2)</th>
                                    <th className="p-2 border-r w-14">Severe (+3)</th>
                                    <th className="p-2 border-r w-14">Extreme (+4)</th>
                                    <th className="p-2 border-r w-16">Score earned</th>
                                    <th className="p-2 w-14">KOOS items #</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                                  {[
                                    { no: '08', text: 'When going down the stairs?', ko: 'A1', key: 'womac_d1' },
                                    { no: '09', text: 'When going up the stairs?', ko: 'A2', key: 'womac_d2' },
                                    { no: '10', text: 'When getting up from a sitting position?', ko: 'A3', key: 'womac_d3' },
                                    { no: '11', text: 'While standing?', ko: 'A4', key: 'womac_d4' },
                                    { no: '12', text: 'When bending to the floor?', ko: 'A5', key: 'womac_d5' },
                                    { no: '13', text: 'When walking on a flat surface?', ko: 'A6', key: 'womac_d6' },
                                    { no: '14', text: 'Getting in or out of a car, or getting on or off a bus?', ko: 'A7', key: 'womac_d7' },
                                    { no: '15', text: 'While going shopping?', ko: 'A8', key: 'womac_d8' },
                                    { no: '16', text: 'When putting on your socks or panty hose or stockings?', ko: 'A9', key: 'womac_d9' },
                                    { no: '17', text: 'When getting out of bed?', ko: 'A10', key: 'womac_d10' },
                                    { no: '18', text: 'When taking off your socks or panty hose or stockings?', ko: 'A11', key: 'womac_d11' },
                                    { no: '19', text: 'When lying in bed?', ko: 'A12', key: 'womac_d12' },
                                    { no: '20', text: 'When getting in or out of the bathtub?', ko: 'A13', key: 'womac_d13' },
                                    { no: '21', text: 'While sitting?', ko: 'A14', key: 'womac_d14' },
                                    { no: '22', text: 'When getting on or off the toilet?', ko: 'A15', key: 'womac_d15' },
                                    { no: '23', text: 'While doing heavy household chores?', ko: 'A16', key: 'womac_d16' },
                                    { no: '24', text: 'While doing light household chores?', ko: 'A17', key: 'womac_d17' }
                                  ].map((row) => (
                                    <tr key={row.key}>
                                      <td className="p-2 border-r text-center font-bold text-slate-600">{row.no}</td>
                                      <td className="p-2 border-r text-slate-800">{row.text}</td>
                                      {[0, 1, 2, 3, 4].map((scoreVal) => (
                                        <td key={scoreVal} className="p-1 border-r text-center">
                                          <input 
                                            type="radio" 
                                            name={row.key}
                                            checked={parseInt(examForm.params?.[row.key] ?? '-1') === scoreVal}
                                            onChange={() => setExamForm({
                                              ...examForm, 
                                              params: { ...examForm.params, [row.key]: scoreVal }
                                            })}
                                            className="text-optm-green focus:ring-optm-green w-3.5 h-3.5 cursor-pointer"
                                          />
                                        </td>
                                      ))}
                                      <td className="p-2 border-r text-center font-bold text-optm-green">
                                        {examForm.params?.[row.key] ?? '-'}
                                      </td>
                                      <td className="p-2 text-center text-slate-500 font-mono">{row.ko}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {(() => {
                              const dailyKeys = ['womac_d1','womac_d2','womac_d3','womac_d4','womac_d5','womac_d6','womac_d7','womac_d8','womac_d9','womac_d10','womac_d11','womac_d12','womac_d13','womac_d14','womac_d15','womac_d16','womac_d17'];
                              const dailyTotal = dailyKeys.reduce((acc, k) => acc + (parseInt(examForm.params?.[k]) || 0), 0);
                              const dailyPercent = ((dailyTotal / 68) * 100).toFixed(1);
                              return (
                                <div className="flex justify-between items-center text-[10.5px] font-bold text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                                  <span>% of FUNCTIONAL ACTIVITIES: Total score earned/68 x100 = <strong className="text-optm-green font-mono">{dailyPercent}%</strong></span>
                                  <span>Total Score earned: <strong className="text-optm-green font-mono text-xs">{dailyTotal} / 68</strong></span>
                                </div>
                              );
                            })()}
                          </div>
                          {(() => {
                            const painTot = ['womac_p1','womac_p2','womac_p3','womac_p4','womac_p5'].reduce((acc, k) => acc + (parseInt(examForm.params?.[k]) || 0), 0);
                            const stifTot = ['womac_s1','womac_s2'].reduce((acc, k) => acc + (parseInt(examForm.params?.[k]) || 0), 0);
                            const dailyKeys = ['womac_d1','womac_d2','womac_d3','womac_d4','womac_d5','womac_d6','womac_d7','womac_d8','womac_d9','womac_d10','womac_d11','womac_d12','womac_d13','womac_d14','womac_d15','womac_d16','womac_d17'];
                            const dailyTot = dailyKeys.reduce((acc, k) => acc + (parseInt(examForm.params?.[k]) || 0), 0);
                            const grandTotal = painTot + stifTot + dailyTot;
                            const totalWomacPercent = ((grandTotal / 96) * 100).toFixed(1);
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl space-y-1 text-xs">
                                <span className="font-black text-amber-400 uppercase tracking-wide block text-[10px]">
                                  TOTAL WOMAC SCORE SUMMARY:
                                </span>
                                <p className="text-[10px] text-slate-300 leading-relaxed font-medium">
                                  Summation of all total score earned by the three subscales (namely, Pain({painTot}) + Stiffness({stifTot}) + Functional activities({dailyTot})) / (20+8+68) x100 = <strong className="text-emerald-400 font-mono text-xs">{totalWomacPercent}%</strong> (Grand Total: {grandTotal} / 96)
                                </p>
                              </div>
                            );
                          })()}
                          <div className="pt-3 border-t space-y-4 text-center">
                            <p className="font-serif italic text-slate-700 text-[11px]">
                              "I have understood the concept thoroughly and answered all the questions consciously best to the present condition of my health"
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                              <div className="space-y-1">
                                <input 
                                  type="text" 
                                  placeholder="Type name to sign" 
                                  className="w-full text-center border-b border-dashed border-slate-400 bg-transparent font-serif italic text-xs py-1 outline-none"
                                  value={examForm.examinerSignature || ''}
                                  onChange={e => setExamForm({...examForm, examinerSignature: e.target.value})}
                                />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  Patient Coordinator/Examiner
                                </span>
                              </div>
                              <div className="space-y-1">
                                <input 
                                  type="text" 
                                  placeholder="Type name to sign" 
                                  className="w-full text-center border-b border-dashed border-slate-400 bg-transparent font-serif italic text-xs py-1 outline-none"
                                  value={examForm.patientSignature || ''}
                                  onChange={e => setExamForm({...examForm, patientSignature: e.target.value})}
                                />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  Signature of Patient/ Patient's Party
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {doctorTab === 'form3' && (
                    <div className="space-y-5 w-full text-xs animate-fade-in">
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                        <div className="border-b pb-1.5">
                          <span className="block font-black text-red-700 text-[10.5px] uppercase tracking-wider">
                            PART-A: VITAL SIGNS PARAMETER:
                          </span>
                          <span className="text-[9px] text-slate-500 italic">(To be thoroughly measured by Physiotherapist / Doctors)</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[9.5px] uppercase">
                                <th className="p-2 border-r w-[40%]">Particular</th>
                                <th className="p-2 border-r w-[35%]">Normal Range</th>
                                <th className="p-2 w-[25%]">Actual Measurement</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[11px] font-semibold text-slate-800">
                              {[
                                { label: 'Body Temperature', normal: '37 degrees Celsius', unit: 'Celsius', key: 'bodyTemp' },
                                { label: 'Blood Oxygen Level (SpO2)', normal: '95% or higher', unit: '%', key: 'spo2' },
                                { label: 'Pulse rate', normal: '60-100 beats/minute', unit: 'b/m', key: 'pulse' },
                                { label: 'Respiration Rate', normal: '12-20/m', unit: '/m', key: 'respirationRate' },
                                { label: 'Blood Pressure', normal: 'Between 100/60mmHg to 120/80mmHg', unit: 'mmHg', key: 'bloodPressure' },
                                { label: 'Blood Glucose Level (at random with Glucose meter)', normal: '99- 100mg/dl', unit: 'mg/dl', key: 'bloodGlucose' }
                              ].map(item => (
                                <tr key={item.key}>
                                  <td className="p-2 border-r font-bold text-slate-800">{item.label}</td>
                                  <td className="p-2 border-r font-medium text-slate-500">{item.normal}</td>
                                  <td className="p-1.5 flex items-center space-x-1.5">
                                    <input 
                                      type="text" 
                                      placeholder="Value"
                                      className="w-24 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-800 font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green"
                                      value={examForm.params?.[item.key] || ''}
                                      onChange={e => setExamForm({
                                        ...examForm,
                                        params: { ...examForm.params, [item.key]: e.target.value }
                                      })}
                                    />
                                    <span className="text-[10px] text-slate-400 font-bold lowercase">{item.unit}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                        <div className="border-b pb-1.5">
                          <span className="block font-black text-red-700 text-[10.5px] uppercase tracking-wider">
                            PART-B: ANTHROPOMETRIC PARAMETER:
                          </span>
                          <span className="text-[9px] text-slate-500 italic">(To be thoroughly measured by Physiotherapist / Doctors)</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[9.5px] uppercase">
                                <th className="p-2 border-r w-[40%]">Particular</th>
                                <th className="p-2 border-r w-[35%]">Normal Range</th>
                                <th className="p-2 w-[25%]">Actual Measurement</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[11px] font-semibold text-slate-800">
                              {[
                                { label: 'Height (H)', normal: 'M:5.6ft(171 cm) / F:5.0ft(151cm)', unit: 'cm', key: 'height' },
                                { label: 'Weight (Wt.)', normal: 'M:65kg / F:55kg', unit: 'kg', key: 'weight' },
                                { label: 'Circumference of waist (WC)', normal: 'M:102cm / F:88cm', unit: 'cm', key: 'waist' },
                                { label: 'Circumference of Hip (HC)', normal: 'M:94-106cm / F:97-108cm', unit: 'cm', key: 'hip' },
                                { label: 'BMI (W/H2)', normal: '≤25-30 kg/m2', unit: 'Kg/m2', key: 'bmi' },
                                { label: 'WHpR (WC/HC)', normal: 'M:0.87-0.99 / F:0.76-0.84', unit: 'ratio', key: 'whpr' },
                                { label: 'WHtR (WC/Wt)', normal: 'M:0.50 / F:0.41', unit: 'ratio', key: 'whtr' }
                              ].map(item => (
                                <tr key={item.key}>
                                  <td className="p-2 border-r font-bold text-slate-800">{item.label}</td>
                                  <td className="p-2 border-r font-medium text-slate-500">{item.normal}</td>
                                  <td className="p-1.5 flex items-center space-x-1.5">
                                    <input 
                                      type="text" 
                                      placeholder="Value"
                                      className="w-24 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-800 font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green"
                                      value={examForm.params?.[item.key] || ''}
                                      onChange={e => setExamForm({
                                        ...examForm,
                                        params: { ...examForm.params, [item.key]: e.target.value }
                                      })}
                                    />
                                    <span className="text-[10px] text-slate-400 font-bold">{item.unit}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                        <div className="border-b pb-1.5">
                          <span className="block font-black text-red-700 text-[10.5px] uppercase tracking-wider">
                            PART-C: PARAMETERS OF LOWER EXTREMITY:
                          </span>
                          <span className="text-[9px] text-slate-500 italic">(To be thoroughly measured by Physiotherapist / Doctor, if the patient has problems in the lower extremity)</span>
                        </div>
                        <div className="overflow-x-auto border rounded-lg border-slate-150">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[9px] uppercase">
                                <th className="p-2 border-r w-[12%]">Parameter</th>
                                <th className="p-2 border-r w-[42%] text-left">Defined as</th>
                                <th className="p-2 border-r w-[16%] text-center">Normal (AAOAS)</th>
                                <th className="p-2 border-r w-[15%] text-center">Right leg</th>
                                <th className="p-2 w-[15%] text-center">Left leg</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[10.5px] font-semibold text-slate-800">
                              {[
                                { name: 'KGB (cm)', desc: 'Knee gap between the short head biceps femoris and surface of the bed in supine position.', rKey: 'kgbRt', lKey: 'kgbLt', norm: '' },
                                { name: 'CAP (cm)', desc: 'Circumference of group of muscles connected with knee joint - 4cm above the patella', rKey: 'capRt', lKey: 'capLt', norm: '' },
                                { name: 'CBP (cm)', desc: 'Circumference of group of muscles connected with knee joint - 4cm below the patella', rKey: 'cbpRt', lKey: 'cbpLt', norm: '' },
                                { name: 'CTM (cm)', desc: 'Circumference of group of thigh muscles', rKey: 'ctmRt', lKey: 'ctmLt', norm: '' },
                                { name: 'CCM (cm)', desc: 'Circumference of group of Calf muscles', rKey: 'ccmRt', lKey: 'ccmLt', norm: '' },
                                { name: 'SLR(S) (°)', desc: 'Angle of straight leg rising in Supine) / angle of Hip joint in supine position', rKey: 'slrSRt', lKey: 'slrSLt', norm: '' },
                                { name: 'SLR(P) (°)', desc: 'Angle of straight leg rising in prone) / angle of Hip joint in prone position', rKey: 'slrPRt', lKey: 'slrPLt', norm: '' },
                                { name: 'KFS (°)', desc: 'Angle of Knee flexion in supine', rKey: 'kfsRt', lKey: 'kfsLt', norm: '' },
                                { name: 'KFP (°)', desc: 'Angle of Knee flexion in prone position', rKey: 'kfpRt', lKey: 'kfpLt', norm: '' },
                                { name: 'KFSt (°)', desc: 'Angle of Knee flexion in standing position', rKey: 'kfstRt', lKey: 'kfstLt', norm: '' },
                                { name: 'KES (°)', desc: 'Angle of Knee extension in supine', rKey: 'kesRt', lKey: 'kesLt', norm: '' },
                                { name: 'KEP (°)', desc: 'Angle of Knee extension in prone', rKey: 'kepRt', lKey: 'kepLt', norm: '' },
                                { name: 'KESt (°)', desc: 'Angle of Knee extension in standing position', rKey: 'kestRt', lKey: 'kestLt', norm: '' }
                              ].map(row => (
                                <tr key={row.name}>
                                  <td className="p-2 border-r font-bold text-slate-800 whitespace-nowrap">{row.name}</td>
                                  <td className="p-2 border-r font-medium text-slate-600 leading-normal">{row.desc}</td>
                                  <td className="p-2 border-r text-center font-bold text-slate-400">{row.norm}</td>
                                  <td className="p-1.5 border-r">
                                    <input 
                                      type="text" placeholder="Right"
                                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-center text-xs font-bold focus:bg-white focus:outline-none"
                                      value={examForm.params?.[row.rKey] || ''}
                                      onChange={e => setExamForm({
                                        ...examForm,
                                        params: { ...examForm.params, [row.rKey]: e.target.value }
                                      })}
                                    />
                                  </td>
                                  <td className="p-1.5">
                                    <input 
                                      type="text" placeholder="Left"
                                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-center text-xs font-bold focus:bg-white focus:outline-none"
                                      value={examForm.params?.[row.lKey] || ''}
                                      onChange={e => setExamForm({
                                        ...examForm,
                                        params: { ...examForm.params, [row.lKey]: e.target.value }
                                      })}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                        <div className="border-b pb-1.5">
                          <span className="block font-black text-red-700 text-[10.5px] uppercase tracking-wider">
                            PART-D: PARAMETERS OF UPPER EXTREMITY:
                          </span>
                          <span className="text-[9px] text-slate-500 italic">(To be thoroughly measured by Physiotherapist / Doctor, if the patient has problems in the upper extremity)</span>
                        </div>
                        <div className="overflow-x-auto border rounded-lg border-slate-150">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[9px] uppercase">
                                <th className="p-2 border-r w-[12%]">Parameter</th>
                                <th className="p-2 border-r w-[42%] text-left">Defined as</th>
                                <th className="p-2 border-r w-[16%] text-center">Normal (AAOAS)</th>
                                <th className="p-2 border-r w-[15%] text-center">Right Hand</th>
                                <th className="p-2 w-[15%] text-center">Left Hand</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[10.5px] font-semibold text-slate-800">
                              {[
                                { name: 'CRCM (cm)', desc: 'Circumference of groups of Rotator cuff muscles about 8cm below the Acromion bone', rKey: 'crcmRt', lKey: 'crcmLt', norm: '' },
                                { name: 'CEAO (cm)', desc: 'Circumference of group of muscles connected with elbow joint about 2cm above the Olecranon', rKey: 'ceaoRt', lKey: 'ceaoLt', norm: '' },
                                { name: 'CEBO (cm)', desc: 'Circumference of group of muscles connected with elbow joint about 2cm below the Olecranon', rKey: 'ceboRt', lKey: 'ceboLt', norm: '' },
                                { name: 'ASFS (degree)', desc: 'Angle of should joint (Glenohumeral joint) flexion in supine position', rKey: 'asfsRt', lKey: 'asfsLt', norm: '' },
                                { name: 'ASASt (degree)', desc: 'Angle of shoulder joint (Glenohumeral joint) abduction in standing', rKey: 'asastRt', lKey: 'asastLt', norm: '' },
                                { name: 'AEFS (degree)', desc: 'Angle of elbow joint (Olecranon joint) flexion in supine position', rKey: 'asfsRt', lKey: 'asfsLt', norm: '' },
                                { name: 'AEES (degree)', desc: 'Angle of elbow joint (Olecranon joint) extension in supine position', rKey: 'aeesRt', lKey: 'aeesLt', norm: '' }
                              ].map(row => (
                                <tr key={row.name}>
                                  <td className="p-2 border-r font-bold text-slate-800 whitespace-nowrap">{row.name}</td>
                                  <td className="p-2 border-r font-medium text-slate-600 leading-normal">{row.desc}</td>
                                  <td className="p-2 border-r text-center font-bold text-slate-400">{row.norm}</td>
                                  <td className="p-1.5 border-r">
                                    <input 
                                      type="text" placeholder="Right"
                                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-center text-xs font-bold focus:bg-white focus:outline-none"
                                      value={examForm.params?.[row.rKey] || ''}
                                      onChange={e => setExamForm({
                                        ...examForm,
                                        params: { ...examForm.params, [row.rKey]: e.target.value }
                                      })}
                                    />
                                  </td>
                                  <td className="p-1.5">
                                    <input 
                                      type="text" placeholder="Left"
                                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-center text-xs font-bold focus:bg-white focus:outline-none"
                                      value={examForm.params?.[row.lKey] || ''}
                                      onChange={e => setExamForm({
                                        ...examForm,
                                        params: { ...examForm.params, [row.lKey]: e.target.value }
                                      })}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-200 mt-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
                          <div className="space-y-1">
                            <input 
                              type="text" 
                              placeholder="Type name to sign" 
                              className="w-full text-center border-b border-dashed border-slate-400 bg-transparent font-serif italic text-xs py-1 outline-none"
                              value={examForm.examinerSignatureForm3 || ''}
                              onChange={e => setExamForm({
                                ...examForm,
                                examinerSignatureForm3: e.target.value
                              })}
                            />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Patient Coordinator/Examiner
                            </span>
                          </div>
                          <div className="space-y-1">
                            <input 
                              type="text" 
                              placeholder="Type name to sign" 
                              className="w-full text-center border-b border-dashed border-slate-400 bg-transparent font-serif italic text-xs py-1 outline-none"
                              value={examForm.patientSignatureForm3 || ''}
                              onChange={e => setExamForm({
                                ...examForm,
                                patientSignatureForm3: e.target.value
                              })}
                            />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Signature of Patient/ Patient’s Party
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-end pt-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Date:</span>
                            <input 
                              type="date" 
                              className="border rounded px-2.5 py-1 bg-white text-xs font-semibold"
                              value={examForm.dateForm3 || ''}
                              onChange={e => setExamForm({
                                ...examForm,
                                dateForm3: e.target.value
                              })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {doctorTab === 'diagnosis' && (
                    <div className="space-y-4 w-full">
                      <div className="space-y-4">
                        <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wide border-b pb-1">
                          Provisional Diagnosis Checklist
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                          {[
                            { key: 'cervicalSpondylosis', label: '1. Cervical Spondylosis' },
                            { key: 'lumbarSpondylosis', label: '2. Lumbar Spondylosis' },
                            { key: 'slippedDisc', label: '3. Slipped Disc' },
                            { key: 'osteoarthritisKnee', label: '4. Osteo-Arthritis (Knee Joint)' },
                            { key: 'calcanealSpur', label: '5. Calcaneal Spur' },
                            { key: 'varicoseVein', label: '6. Varicose Vein' },
                            { key: 'migraineSinusitis', label: '7. Migraine / Sinusitis' },
                            { key: 'sleeplessness', label: '8. Sleeplessness' },
                            { key: 'incontinence', label: '9. Incontinence' },
                            { key: 'constipation', label: '10. Constipation' },
                            { key: 'acidityGas', label: '11. Acidity / Gas' },
                            { key: 'vertigo', label: '12. Vertigo' },
                            { key: 'depression', label: '13. Depression' },
                            { key: 'ankylosingSpondylitis', label: '14. Ankylosing Spondylitis' },
                            { key: 'rheumatoidArthritis', label: '15. Rhematiod Arthritis' },
                            { key: 'polyArthritis', label: '16. Poly-arthritis' }
                           ].map((item) => (
                            <label key={item.key} className="flex items-center space-x-2 p-2 border border-optm-gray rounded-lg hover:bg-optm-alabaster cursor-pointer transition bg-white">
                              <input 
                                type="checkbox"
                                className="rounded border-optm-gray text-optm-green focus:ring-optm-green w-3.5 h-3.5"
                                checked={examForm.diagnosis[item.key] || false}
                                onChange={e => setExamForm({
                                  ...examForm,
                                  diagnosis: { ...examForm.diagnosis, [item.key]: e.target.checked }
                                })}
                              />
                              <span className="font-semibold text-slate-700 text-[11px]">{item.label}</span>
                            </label>
                          ))}
                        </div>
                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                          <div className="flex flex-col items-center space-y-1.5 w-64 text-center">
                            <input 
                              type="text" 
                              placeholder="Type doctor name to sign" 
                              className="w-full text-center border-b border-dashed border-slate-400 focus:border-sky-600 focus:outline-none bg-transparent font-serif italic text-sm py-1"
                              value={examForm.doctorSignature || ''}
                              onChange={e => setExamForm({...examForm, doctorSignature: e.target.value})}
                            />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Signature of Doctor
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {doctorTab === 'packages' && (
                    <div className="space-y-4 w-full">
                      <div className="border border-slate-200 bg-slate-50 p-4 rounded-xl">                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3 text-xs">
                            <div>
                              <label className="block text-[9px] font-extrabold text-slate-600 uppercase mb-1">Package Category</label>
                              <select 
                                className="w-full border rounded-lg p-2 bg-white font-bold text-slate-800 text-xs"
                                value={examForm.packageId}
                                onChange={e => {
                                  setManuallyOverridden(true);
                                  setExamForm({...examForm, packageId: e.target.value});
                                }}
                              >
                                <option value="">-- Select Package --</option>
                                <option value="two_limbs">Two Limbs (Upper/Lower Limbs) Package</option>
                                <option value="four_limbs">Four Limbs (Neck Back & Legs) Package</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] font-extrabold text-slate-600 uppercase mb-1">Number of Sittings</label>
                              <div className="grid grid-cols-3 gap-1.5">
                                {['6', '21', '42'].map(s => (
                                  <button
                                    key={s} type="button"
                                    onClick={() => {
                                      setManuallyOverridden(true);
                                      setExamForm({...examForm, sittingsCount: s});
                                    }}
                                    className={`py-1.5 rounded-lg font-bold border text-xs transition cursor-pointer ${
                                      examForm.sittingsCount === s 
                                        ? 'bg-optm-green border-optm-green text-white' 
                                        : 'bg-white border-optm-gray text-optm-green hover:bg-optm-alabaster'
                                    }`}
                                  >
                                    {s} Sittings
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="pt-2">
                              <label className="flex items-center space-x-2 bg-white border border-slate-200 rounded-lg p-2 cursor-pointer hover:bg-slate-50 transition">
                                <input 
                                  type="checkbox"
                                  className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-4 h-4 cursor-pointer"
                                  checked={examForm.needsNutritionist || false}
                                  onChange={e => setExamForm({...examForm, needsNutritionist: e.target.checked})}
                                />
                                <div className="leading-tight">
                                  <span className="text-xs font-bold text-slate-800 block">Refer to Nutritionist</span>
                                  <span className="text-[9px] text-slate-400">Queue this patient for a dietary consultation</span>
                                </div>
                              </label>
                            </div>
                          </div>
                          <div className="bg-white border border-slate-200 p-3 rounded-lg space-y-1.5 text-xs">
                            <h4 className="font-extrabold text-slate-800 border-b pb-1 text-[9px] uppercase tracking-wide text-optm-green flex items-center justify-between">
                              <span>Bill Estimation Details</span>
                              <span className="bg-slate-100 text-[9px] text-slate-500 px-1 py-0.5 rounded uppercase">INR (₹)</span>
                            </h4>
                            {(() => {
                              const selectedPack = PACKAGES[examForm.packageId];
                              const details = selectedPack?.sittings[parseInt(examForm.sittingsCount)];
                              if (!details) {
                                return (
                                  <div className="text-center py-6 text-slate-400 font-semibold italic text-[11px]">
                                    Please select a package category and sittings count to preview bill estimation.
                                  </div>
                                );
                              }
                              return (
                                <div className="space-y-1 text-slate-600 text-[11px]">
                                  <div className="flex justify-between">
                                    <span>2-JP + LL + NPF-1 Combo (Qty: {details.qty.combo})</span>
                                    <span className="font-bold">₹{details.combo.toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Phyto Proflex Capsules (Qty: {details.qty.proflex})</span>
                                    <span className="font-bold">₹{details.proflex.toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Morn Blossom Sachets (Qty: {details.qty.sachet})</span>
                                    <span className="font-bold">₹{details.sachet.toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Phyto Crystal Drops (Qty: {details.qty.crystal})</span>
                                    <span className="font-bold">₹{details.crystal.toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="flex justify-between border-b pb-1">
                                    <span>Clinical Sitting Treatment Cost (Qty: {details.qty.treatment})</span>
                                    <span className="font-bold">₹{details.treatment.toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[11px] font-extrabold text-emerald-600 pt-1">
                                    <span>NET PAYABLE BILL AMOUNT:</span>
                                    <span className="text-xs font-black">₹{details.net.toLocaleString('en-IN')}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  </fieldset>
                </div>
                <div className="bg-optm-alabaster border-t border-optm-gray p-3 flex justify-between items-center text-xs">
                  <button 
  type="button"
  onClick={() => {
    if (isEditingChart) {
      setShowDiscardConfirm(true);
    } else {
      setActiveConsultation(null);
    }
  }}
  className="bg-optm-gray/20 hover:bg-optm-gray/40 text-optm-green font-bold py-1.5 px-4 rounded-lg cursor-pointer border border-optm-gray"
>
  Cancel
</button>
{doctorTab === 'general' && (
  <button 
    onClick={() => setDoctorTab('parameters')}
    className="bg-optm-green hover:bg-opacity-95 text-white font-bold py-1.5 px-5 rounded-lg shadow flex items-center cursor-pointer transition-all duration-200"
  >
    Go to Form-II <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
  </button>
)}
{doctorTab === 'parameters' && (
  <button 
    onClick={() => setDoctorTab('form3')}
    className="bg-optm-green hover:bg-opacity-95 text-white font-bold py-1.5 px-5 rounded-lg shadow flex items-center cursor-pointer transition-all duration-200"
  >
    Go to Form-III <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
  </button>
)}
{doctorTab === 'form3' && (
  <button 
    onClick={() => setDoctorTab('diagnosis')}
    className="bg-optm-green hover:bg-opacity-95 text-white font-bold py-1.5 px-5 rounded-lg shadow flex items-center cursor-pointer transition-all duration-200"
  >
    Go to Provisional Diagnosis <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
  </button>
)}
{doctorTab === 'diagnosis' && (
  <button 
    onClick={() => setDoctorTab('packages')}
    className="bg-optm-green hover:bg-opacity-95 text-white font-bold py-1.5 px-5 rounded-lg shadow flex items-center cursor-pointer transition-all duration-200"
  >
    Go to Prescribed Packages <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
  </button>
)}
{activeConsultation?.isReadOnly && isEditingChart ? (
  <button 
    onClick={handleUpdateChart}
    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-1.5 px-5 rounded-lg shadow flex items-center cursor-pointer transition-all duration-200"
  >
    💾 Save & Update Chart
  </button>
) : (!activeConsultation?.isReadOnly && doctorTab === 'packages') ? (
      <button 
        onClick={handleSaveConsultation}
        className="bg-optm-green hover:bg-opacity-95 text-white font-extrabold py-1.5 px-5 rounded-lg shadow flex items-center cursor-pointer transition-all duration-200"
      >
        Confirm & Save Prescription <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
      </button>
    ) : null}
                </div>
              </div>
            )}
          </div>
        )}
        {/* =======================================================================
            WORKSPACE 4: NUTRITIONIST'S DESK (FULL WORDS - COMPACT SINGLE PAGE)
            ======================================================================= */}
        {currentRole === 'nutritionist' && (
          <div className="flex-grow flex flex-col min-h-0">
            {!activeConsultation ? (
              <div className="space-y-3">
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
  <div className="py-2.5 px-3.5 border-b border-slate-150 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2.5">
    <div className="relative flex-grow max-w-sm">
      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
      <input 
        type="text"
        placeholder="Search nutrition queue by name, token, or phone..."
        className="w-full pl-8 pr-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-700 text-slate-900 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 transition shadow-2xs"
        value={frontOfficeSearch}
        onChange={e => setFrontOfficeSearch(e.target.value)}
      />
    </div>
    <div className="flex items-center space-x-2">
      <span className="bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-extrabold border border-emerald-500/30 uppercase">
        {patients.filter(p => (p.status === 'Prescribed & Awaiting Payment' || p.status?.startsWith('Treatment Active')) && p.needsNutritionist === true).length} Pending
      </span>
      <button 
        onClick={fetchPatients}
        title="Refresh Nutritionist Queue"
        className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 text-white transition cursor-pointer shadow-2xs active:scale-95"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  </div>
</div>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest shadow-sm border-b border-white/10">
  <div className="col-span-2 flex items-center gap-1.5 text-emerald-400">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
    <span>Token / ID</span>
  </div>
  <div className="col-span-3">Patient Profile</div>
  <div className="col-span-4">Status & Check-In</div>
  <div className="col-span-3 text-right">Action</div>
</div>
                  <div className="divide-y divide-slate-150">
  {patients
    .filter(pat => {
      const isTarget = (pat.status === 'Prescribed & Awaiting Payment' || pat.status?.startsWith('Treatment Active')) && pat.needsNutritionist === true;
      const matchesSearch = 
        (pat.firstName || '').toLowerCase().includes(frontOfficeSearch.toLowerCase()) ||
        (pat.lastName || '').toLowerCase().includes(frontOfficeSearch.toLowerCase()) ||
        (pat.regNo || '').toLowerCase().includes(frontOfficeSearch.toLowerCase()) ||
        (pat.phone || '').includes(frontOfficeSearch);
      return isTarget && matchesSearch;
    })
    .map((pat) => (
      <div key={pat.id} className="px-4 py-3 hover:bg-emerald-50/30 transition-all grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs">
        <div className="col-span-12 md:col-span-2">
          <span className="font-mono text-xs font-black text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
            {pat.regNo}
          </span>
        </div>
        <div className="col-span-12 md:col-span-3 space-y-0.5">
          <span className="font-black text-slate-900 text-sm block capitalize">{pat.firstName} {pat.lastName}</span>
          <div className="text-[11px] text-slate-500 font-bold flex items-center gap-x-2">
  <span>Ph: <strong className="text-slate-800">{pat.phone}</strong></span>
  {pat.email && <span className="text-[10px] text-slate-400 font-medium border-l border-slate-200 pl-2 lowercase">{pat.email}</span>}
</div>
        </div>
        <div className="col-span-12 md:col-span-4 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter">
              {pat.status}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-bold flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            {pat.registrationDate || 'Recently Registered'}
          </div>
        </div>
        <div className="col-span-12 md:col-span-3 text-right">
  <button 
    onClick={() => openDoctorChart(pat)}
    className="bg-slate-950 hover:bg-emerald-700 !text-white font-black text-[10px] py-2 px-5 rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest border border-slate-800 flex items-center justify-center gap-2.5 ml-auto group cursor-pointer"
  >
    <FileText className="w-3.5 h-3.5 text-emerald-400 group-hover:text-white transition-colors" />
    <span className="!text-white tracking-[0.1em]">Open Dietary Chart</span>
  </button>
</div>
      </div>
    ))}
</div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in flex flex-col h-[calc(100vh-140px)]">
<div className="bg-slate-950 text-white py-2 px-4 flex items-center justify-between shrink-0 border-b-2 border-optm-goldenrod shadow-xl z-10">
  <div className="flex items-center gap-4">
   <button 
  onClick={() => {
    if (activeConsultation?.isReadOnly && !isEditingChart) {
      setActiveConsultation(null);
      return;
    }
    setShowDiscardConfirm(true);
  }} 
  className="group flex items-center gap-2 bg-white/10 hover:bg-red-600/20 hover:border-red-500/50 text-white border border-white/10 px-2 py-1.5 rounded-lg transition-all cursor-pointer active:scale-95"
>
  <ArrowLeft className="w-3.5 h-3.5 text-optm-goldenrod group-hover:text-red-400" />
  <span className="text-[10px] font-black uppercase tracking-tight group-hover:text-red-400">Back</span>
</button>
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-optm-goldenrod flex items-center justify-center text-slate-950 font-black text-xs shadow-inner">
        {activeConsultation.firstName.charAt(0)}
      </div>
      <div className="leading-none">
        <h3 className="text-[12px] font-black uppercase tracking-tighter text-white">
          {activeConsultation.firstName} {activeConsultation.lastName}
        </h3>
        <div className="flex items-center gap-2 mt-0.5 text-[9px] font-extrabold uppercase tracking-widest">
          <span className="text-emerald-400 font-mono">{activeConsultation.regNo}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">DOB: <span className="text-slate-200">{activeConsultation.dob || 'N/A'}</span></span>
        </div>
      </div>
    </div>
  </div>
  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={() => setSelectedPatientLogs(activeConsultation)}
      className="px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-800 hover:bg-slate-700 text-optm-goldenrod border border-slate-700 hover:border-optm-goldenrod/30 transition shadow-2xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
    >
      <History className="w-3.5 h-3.5 text-optm-goldenrod" />
      <span>View Logs</span>
    </button>
    <button 
      onClick={handleSaveNutritionist} 
      className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-[0_4px_12px_rgba(5,150,105,0.3)] active:scale-95 transition-all border border-emerald-400/20"
    >
      Commit & Save Chart
    </button>
  </div>
</div>
                <div className="flex-grow overflow-hidden bg-slate-50 p-2">
                  <div className="grid grid-cols-12 gap-2 h-full overflow-hidden">
                    <div className="col-span-8 flex flex-col gap-2 overflow-hidden">
                      <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xs overflow-y-auto">
                        <div className="flex items-center gap-1.5 mb-2 border-b border-slate-100 pb-1">
                          <Activity className="w-3 h-3 text-optm-green" />
                          <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest">Biometric & Lifestyle Index</span>
                        </div>
                        <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                          {[
                            { label: 'Chief Complaints', key: 'chiefComplaints' },
                            { label: 'Clinical Observation', key: 'observation' },
                            { label: 'Current Occupation', key: 'occupation' },
                            { label: 'Lightest Adult Weight (5 Years)', key: 'lightestWeight5Years' },
                            { label: 'Body Mass Index (BMI)', key: 'bmi' },
                            { label: 'Blood Pressure', key: 'bp' },
                            { label: 'Pulse Rate', key: 'pulseRate' },
                            { label: 'Meal Preferences', key: 'mealPreferences' },
                            { label: 'Physical Exercise', key: 'exercise' },
                            { label: 'Daily Water Intake', key: 'waterIntake' },
                            { label: 'Sleep Duration', key: 'sleep' },
                            { label: 'Constipation Status', key: 'constipation' },
                            { label: 'Bloating & Gas', key: 'bloating' },
                            { label: 'Stress Incontinence', key: 'stressIncontinence' },
                            { label: 'Bladder Irritation', key: 'bladderIrritation' },
                            { label: 'Food Allergies', key: 'foodAllergies' }
                          ].map(f => (
                            <div key={f.key}>
                              <label className="block text-[7.5px] font-black text-slate-500 uppercase mb-0.5 tracking-tighter">{f.label}</label>
                              <input 
                                type="text" className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-black text-slate-800 focus:bg-white outline-none"
                                value={examForm.nutritionist?.[f.key] || ''}
                                onChange={e => setExamForm({...examForm, nutritionist: { ...examForm.nutritionist, [f.key]: e.target.value }})}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="block text-[7.5px] font-black text-slate-500 uppercase mb-0.5">Family Medical History</label>
                            <textarea rows="1" className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10px] font-medium outline-none resize-none" value={examForm.nutritionist?.familyHistory || ''} onChange={e => setExamForm({...examForm, nutritionist: {...examForm.nutritionist, familyHistory: e.target.value}})} />
                          </div>
                          <div>
                            <label className="block text-[7.5px] font-black text-slate-500 uppercase mb-0.5">Social & Surgical History</label>
                            <textarea rows="1" className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10px] font-medium outline-none resize-none" value={examForm.nutritionist?.socialHistory || ''} onChange={e => setExamForm({...examForm, nutritionist: {...examForm.nutritionist, socialHistory: e.target.value}})} />
                          </div>
                        </div>
                      </div>
                      <div className="bg-amber-50/30 border border-amber-200/50 rounded-xl p-2">
                        <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest block mb-1.5">Food Recall</span>
                        <div className="grid grid-cols-6 gap-1.5">
                          {['Breakfast', 'Midmorning', 'Lunch', 'EveningSnack', 'Dinner', 'PostDinner'].map(meal => (
                            <div key={meal}>
                              <label className="block text-[7px] font-black text-amber-700/60 uppercase mb-0.5">{meal}</label>
                              <textarea 
                                className="w-full h-12 bg-white border border-amber-200 rounded p-1 text-[9.5px] font-bold text-slate-800 outline-none resize-none"
                                value={examForm.nutritionist?.foodRecall?.[meal.toLowerCase()] || ''}
                                onChange={e => setExamForm({...examForm, nutritionist: { ...examForm.nutritionist, foodRecall: { ...examForm.nutritionist.foodRecall, [meal.toLowerCase()]: e.target.value }}})}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-4 flex flex-col gap-2 overflow-hidden">
                      <div className="bg-white border border-slate-200 rounded-xl p-2 space-y-2">
                        <span className="block text-[8px] font-black text-slate-400 uppercase">Lifestyle & Habits</span>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                          {[
                            { label: 'Last Dental Check-Up', key: 'lastDentalCheckup' },
                            { label: 'Number of Caries', key: 'numberOfCaries' },
                            { label: 'Salt Used for Cooking', key: 'saltUsed' },
                            { label: 'Oil Used for Cooking', key: 'oilUsed' },
                            { label: 'Stress Eating Behavior', key: 'stressEating' },
                            { label: 'Binge Eating Behavior', key: 'bingeEating' },
                            { label: 'Frequent Food Cravings', key: 'cravings' },
                            { label: 'Outside Eating Habits', key: 'outsideEating' }
                          ].map(f => (
                            <div key={f.key}>
                              <label className="block text-[7px] font-black text-slate-400 uppercase">{f.label}</label>
                              <input type="text" className="w-full border-b border-slate-100 text-[9.5px] font-black p-0.5 outline-none" value={examForm.nutritionist?.[f.key] || ''} onChange={e => setExamForm({...examForm, nutritionist: { ...examForm.nutritionist, [f.key]: e.target.value }})} />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex-grow flex flex-col bg-white border border-emerald-500/20 rounded-xl p-2 shadow-sm">
                        <span className="text-[9px] font-black text-emerald-700 uppercase flex items-center gap-1 mb-1">
                          <FileText className="w-2.5 h-2.5" /> Nutritionist Recommendation
                        </span>
                        <textarea 
                          className="flex-grow w-full bg-emerald-50/20 border border-emerald-100 rounded p-2 text-[10px] font-black text-slate-800 outline-none resize-none"
                          value={examForm.nutritionist?.nutritionistsNote || ''}
                          onChange={e => setExamForm({...examForm, nutritionist: { ...examForm.nutritionist, nutritionistsNote: e.target.value }})}
                          placeholder="Enter final dietary recommendations..."
                        />
                      </div>
                      <div className="bg-red-50 border border-red-100 rounded-xl p-2">
                        <span className="block text-[8px] font-black text-red-700 uppercase mb-0.5">Physician Constraints:</span>
                        <p className="text-[10px] font-bold text-red-900 leading-tight italic">
                          {activeConsultation.nutritionist?.doctorsNote || 'No specific restrictions mentioned by doctor.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
            {editingProfile && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3">
                <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
<div className="bg-optm-green text-white px-3.5 py-2 flex items-center justify-between border-b border-white/10 flex-shrink-0">
  <div className="flex items-center space-x-3">
    <FileText className="w-3.5 h-3.5 text-optm-goldenrod" />
    <h3 className="text-xs font-bold text-white tracking-tight">
      {!originalProfile ? 'Quick Registration' : 'Patient Demographics'}
    </h3>
    {editingProfile.regNo && (
      <span className="bg-optm-goldenrod/20 text-optm-goldenrod text-[10px] font-black px-2 py-0.5 rounded border border-optm-goldenrod/30 font-mono">
        {editingProfile.regNo}
      </span>
    )}
  </div>
  <div className="flex items-center space-x-2.5">
    {originalProfile && (
      <button
        type="button"
        onClick={() => setIsDemographicsLocked(!isDemographicsLocked)}
        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5 border shadow-sm cursor-pointer ${
          isDemographicsLocked 
          ? 'bg-amber-400 text-slate-900 border-amber-500 hover:bg-amber-300' 
          : 'bg-red-600 text-white border-red-700 hover:bg-red-500'
        }`}
      >
        {isDemographicsLocked ? (
          <><Lock className="w-3 h-3" /> Unlock</>
        ) : (
          <><ShieldCheck className="w-3 h-3" /> Lock</>
        )}
      </button>
    )}
    <button 
      type="button"
      onClick={handleCloseProfileEdit}
      className="w-6 h-6 rounded-lg hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center font-bold text-xs transition cursor-pointer"
    >
      ✕
    </button>
  </div>
</div>
                  <form onSubmit={handleSaveProfile} className="flex-1 flex flex-col min-h-0 bg-slate-50/40 text-xs overflow-hidden">
  <div className={`flex-1 overflow-y-auto p-2.5 space-y-2 transition-all ${isDemographicsLocked && originalProfile ? 'bg-slate-50/80' : 'bg-white'}`}>
    <fieldset 
      disabled={originalProfile ? isDemographicsLocked : false} 
      className="space-y-2 border-0 p-0 m-0"
    >
                    <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 mb-0.5">First Name *</label>
                          <input 
                            type="text" required 
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green"
                            value={editingProfile.firstName || ''}
                            onChange={e => setEditingProfile({...editingProfile, firstName: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Last Name *</label>
                          <input 
                            type="text" required 
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green"
                            value={editingProfile.lastName || ''}
                            onChange={e => setEditingProfile({...editingProfile, lastName: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 mb-0.5">DOB</label>
                          <input 
                            type="date" 
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green"
                            value={editingProfile.dob || ''}
                            onChange={e => setEditingProfile({...editingProfile, dob: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Sex</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green cursor-pointer"
                            value={editingProfile.sex || ''}
                            onChange={e => setEditingProfile({...editingProfile, sex: e.target.value})}
                          >
                            <option value="">-- Select --</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>
                        <div>
  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Mobile *</label>
  <input 
    type="tel" required 
    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green"
    value={editingProfile.phone || ''}
    onChange={e => setEditingProfile({...editingProfile, phone: e.target.value})}
  />
</div>
<div>
  <label className="block text-[9px] font-bold text-slate-600 mb-0.5">Email Address</label>
  <input 
    type="email" 
    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green"
    value={editingProfile.email || ''}
    onChange={e => setEditingProfile({...editingProfile, email: e.target.value})}
  />
</div>
                      </div>
                      <div>
                        {(!editingProfile.phoneR && !editingProfile.phoneO && !editingProfile._showAltPhones) ? (
                          <button
                            type="button"
                            onClick={() => setEditingProfile({ ...editingProfile, _showAltPhones: true })}
                            className="text-[9.5px] font-bold text-optm-green hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3 text-optm-green" />
                            <span>+ Add Residence / Office Phone Numbers</span>
                          </button>
                        ) : (
                          <div className="space-y-1 pt-0.5 animate-fade-in bg-slate-50 p-2 rounded-lg border border-slate-200/70">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Alternate Phone Numbers</span>
                              <button
                                type="button"
                                onClick={() => setEditingProfile({ 
                                  ...editingProfile, 
                                  _showAltPhones: false, 
                                  phoneR: '', 
                                  phoneO: '' 
                                })}
                                className="text-[9.5px] font-bold text-red-600 hover:text-red-700 cursor-pointer flex items-center gap-1 bg-white px-1.5 py-0.2 rounded border border-slate-200 shadow-2xs"
                                title="Hide fields"
                              >
                                <EyeOff className="w-2.5 h-2.5 text-red-500" />
                                <span>Hide</span>
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[8.5px] font-bold text-slate-500 mb-0.5">Phone (Res.)</label>
                                <input 
                                  type="tel" placeholder="Residence phone"
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-optm-green"
                                  value={editingProfile.phoneR || ''}
                                  onChange={e => setEditingProfile({...editingProfile, phoneR: e.target.value})}
                                />
                              </div>
                              <div>
                                <label className="block text-[8.5px] font-bold text-slate-500 mb-0.5">Phone (Off.)</label>
                                <input 
                                  type="tel" placeholder="Office phone"
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-optm-green"
                                  value={editingProfile.phoneO || ''}
                                  onChange={e => setEditingProfile({...editingProfile, phoneO: e.target.value})}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs space-y-1.5">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-6">
                          <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Address</label>
                          <input 
                            type="text" placeholder="House / Street"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green"
                            value={editingProfile.address || ''}
                            onChange={e => setEditingProfile({...editingProfile, address: e.target.value})}
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-[9px] font-bold text-slate-500 mb-0.5">Pincode</label>
                          <input 
                            type="text" placeholder="110008"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green"
                            value={editingProfile.pincode || ''}
                            onChange={e => setEditingProfile({...editingProfile, pincode: e.target.value})}
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-[9px] font-bold text-slate-500 mb-0.5">City / State</label>
                          <input 
                            type="text" placeholder="Delhi"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green"
                            value={editingProfile.cityState || ''}
                            onChange={e => setEditingProfile({...editingProfile, cityState: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
{originalProfile && (
  <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
                      <div className="space-y-1 pt-0.5">
                        <label className="block text-[9px] font-black text-red-700 uppercase tracking-wide">
                          REFERRED BY:
                        </label>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 bg-slate-50 p-1.5 rounded-lg border border-slate-150">
                          {['Doctor', 'Friend', 'Relative', 'Patient', 'Newspaper', 'E-Communication', 'Walk-in'].map(refOption => (
                            <label key={refOption} className="flex items-center space-x-1 cursor-pointer">
                              <input 
                                type="radio"
                                name="referredByRadio"
                                className="text-optm-green focus:ring-optm-green w-3 h-3"
                                checked={editingProfile.referredBy === refOption}
                                onChange={() => setEditingProfile({ ...editingProfile, referredBy: refOption })}
                              />
                              <span className="font-bold text-slate-800 text-[10px]">{refOption}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1 pt-1 border-t border-slate-150">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black text-red-700 uppercase tracking-wide">
                            NAME OF REFERRAL:
                          </label>
                          <button
  type="button"
  onClick={() => setEditingProfile({
    ...editingProfile,
    referralNames: [...(editingProfile.referralNames || ['']), '']
  })}
  className="text-[10px] font-black text-optm-green bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 hover:bg-emerald-100 cursor-pointer transition-colors"
>
  + Add Referral Name
</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {(editingProfile.referralNames || ['']).map((name, idx) => (
                            <div key={idx} className="flex items-center space-x-1.5 bg-slate-50 p-1 px-2 rounded border border-slate-150">
                              <span className="text-[9px] font-bold text-slate-400 font-mono">{idx + 1}.</span>
                              <input 
                                type="text" 
                                placeholder={`Referral name ${idx + 1}`}
                                className="w-full border-none bg-transparent text-[10.5px] text-slate-900 font-medium focus:outline-none"
                                value={name}
                                onChange={e => {
                                  const list = [...(editingProfile.referralNames || [''])];
                                  list[idx] = e.target.value;
                                  setEditingProfile({ ...editingProfile, referralNames: list });
                                }}
                              />
                              {(editingProfile.referralNames || ['']).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const list = editingProfile.referralNames.filter((_, i) => i !== idx);
                                    setEditingProfile({ ...editingProfile, referralNames: list });
                                  }}
                                  className="text-slate-400 hover:text-red-600 font-bold text-xs p-0.5 cursor-pointer transition"
                                  title="Remove referral name"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1 pt-1 border-t border-slate-150">
                        <label className="block text-[9px] font-black text-red-700 uppercase tracking-wide">
                          IS/WAS REFERRAL TREATED IN CLINIC?:
                        </label>
                        <div className="flex items-center space-x-4 bg-slate-50 p-1.5 rounded-lg border border-slate-150">
                          {['YES', 'NO', 'NOT KNOWN'].map(status => (
                            <label key={status} className="flex items-center space-x-1.5 cursor-pointer">
                              <input 
                                type="radio"
                                name="treatedRadio"
                                className="text-optm-green focus:ring-optm-green w-3 h-3"
                                checked={(editingProfile.treatedInClinic || '').toUpperCase() === status}
                                onChange={() => setEditingProfile({ ...editingProfile, treatedInClinic: status })}
                              />
                              <span className="font-extrabold text-slate-800 text-[10px]">{status}</span>
                            </label>
                          ))}
                        </div>
                        {(editingProfile.treatedInClinic || '').toUpperCase() === 'YES' && (
                          <div className="grid grid-cols-2 gap-2 pt-1 pl-1 animate-fade-in">
                            <div className="flex items-center space-x-1.5 bg-slate-50 p-1 rounded border border-slate-150">
                              <span className="font-bold text-slate-600 text-[9.5px] whitespace-nowrap">a) When:</span>
                              <input 
                                type="text"
                                required
                                placeholder="Year / Month"
                                className="w-full border-none bg-transparent text-[10.5px] text-slate-900 font-medium focus:outline-none"
                                value={editingProfile.treatedWhen || ''}
                                onChange={e => setEditingProfile({ ...editingProfile, treatedWhen: e.target.value })}
                              />
                            </div>
                            <div className="flex items-center space-x-1.5 bg-slate-50 p-1 rounded border border-slate-150">
                              <span className="font-bold text-slate-600 text-[9.5px] whitespace-nowrap">b) Cured:</span>
                              <input 
                                type="text"
                                required
                                placeholder="Yes / No"
                                className="w-full border-none bg-transparent text-[10.5px] text-slate-900 font-medium focus:outline-none"
                                value={editingProfile.treatedCured || ''}
                                onChange={e => setEditingProfile({ ...editingProfile, treatedCured: e.target.value })}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 pt-1 border-t border-slate-150">
                        <label className="block text-[9px] font-black text-red-700 uppercase tracking-wide">
                          CHIEF COMPLAINT (C/C) PRESENT:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 bg-slate-50 p-2 rounded-lg border border-slate-150 max-h-32 overflow-y-auto">
                          {[
                            'Pain', 'Obesity', 'Varicose veins', 'Urinary incontinence', 'Swelling', 'Stiffness', 'Headaches',
                            'Sinusitis', 'Insomnia', 'Reflux', 'Acidity', 'Indigestion', 'Bell’s palsy (Facial paralysis)', 'Paralysis',
                            'Skin disorders', 'Gynecological disorders', 'Dysmenorrhea', 'Cellulitis', 'Psychosomatic disorders'
                          ].map(comp => {
                            const mapKey = comp.toLowerCase().replace(/[^a-z]/g, '');
                            return (
                              <label key={comp} className="flex items-center space-x-1.5 cursor-pointer py-0.5">
                                <input 
                                  type="checkbox"
                                  className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-3 h-3"
                                  checked={editingProfile.complaints?.[mapKey] || false}
                                  onChange={e => {
                                    const updated = { ...(editingProfile.complaints || {}), [mapKey]: e.target.checked };
                                    setEditingProfile({ ...editingProfile, complaints: updated });
                                  }}
                                />
                                <span className="font-medium text-slate-800 text-[9.5px] truncate">{comp}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-1 pt-1 border-t border-slate-150">
                        <label className="block text-[9px] font-black text-red-700 uppercase tracking-wide">
                          LOCATION:
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 bg-slate-50 p-2 rounded-lg border border-slate-150 max-h-32 overflow-y-auto">
                          {[
                            'Neck', 'Arm', 'Armpit', 'Shoulder', 'Elbow', 'Back', 'Waist', 'Hands', 'Fingers', 'Groin', 'Thigh',
                            'Calf', 'Ankle', 'Feet', 'Toes', 'Knee Joint', 'Heel', 'Hip-joint', 'Sternocleidomastoid', 'Buttock',
                            'Abdomen', 'Forehead', 'Thoracic', 'Lumbar'
                          ].map(loc => {
                            const locKey = loc.toLowerCase().replace(/[^a-z]/g, '');
                            return (
                              <label key={loc} className="flex items-center space-x-1 cursor-pointer py-0.5">
                                <input 
                                  type="checkbox"
                                  className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-3 h-3"
                                  checked={editingProfile.generalLocations?.[locKey] || false}
                                  onChange={e => {
                                    const updatedLocs = { ...(editingProfile.generalLocations || {}), [locKey]: e.target.checked };
                                    setEditingProfile({ ...editingProfile, generalLocations: updatedLocs });
                                  }}
                                />
                                <span className="font-medium text-slate-800 text-[9.5px] truncate">{loc}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-1 pt-1 border-t border-slate-150">
                        <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-lg border border-slate-150">
                          <label className="font-black text-red-700 uppercase tracking-wide text-[9px] whitespace-nowrap">
                            PERIOD OF SUFFERING?:
                          </label>
                          <input 
                            type="text" 
                            placeholder="e.g. 6 Months"
                            className="w-full border-b border-dashed border-slate-400 bg-transparent text-[10.5px] text-slate-900 font-medium px-1 focus:outline-none"
                            value={editingProfile.periodOfSuffering || ''}
                            onChange={e => setEditingProfile({ ...editingProfile, periodOfSuffering: e.target.value })}
                          />
                          <span className="font-bold text-slate-500 text-[9px] whitespace-nowrap">Years/Months</span>
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1 border-t border-slate-150">
                        <label className="block text-[10px] font-black text-red-700 uppercase tracking-wide">
                          IF PAIN IS C/C, LOCATION OF PAIN:
                        </label>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                          {[
                            { id: 'lumbosacralSpine', label: 'Lumbosacral spine' },
                            { id: 'thorasicSpine', label: 'Thoracic spine' },
                            { id: 'cervicalSpine', label: 'Cervical spine' },
                            { id: 'chest', label: 'Chest' }
                          ].map(item => (
                            <div key={item.id} className="flex items-center justify-between py-0.5 pl-2">
                              <span className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 inline-block"></span>
                                {item.label}
                              </span>
                              <label className="flex items-center space-x-1 cursor-pointer pr-4">
                                <input 
                                  type="checkbox"
                                  className="rounded border-slate-300 text-optm-green focus:ring-optm-green w-3.5 h-3.5"
                                  checked={editingProfile.spineChestLocations?.[item.id] || false}
                                  onChange={e => {
                                    const updatedSpine = { ...(editingProfile.spineChestLocations || {}), [item.id]: e.target.checked };
                                    setEditingProfile({ ...editingProfile, spineChestLocations: updatedSpine });
                                  }}
                                />
                              </label>
                            </div>
                          ))}
                          {[
                            { id: 'shoulder', label: 'Shoulder' },
                            { id: 'arms', label: 'Arm' },
                            { id: 'hands', label: 'Hand' },
                            { id: 'fingers', label: 'Finger' },
                            { id: 'hips', label: 'Hip' },
                            { id: 'legs', label: 'Leg' },
                            { id: 'knees', label: 'Knee' },
                            { id: 'ankles', label: 'Ankle' },
                            { id: 'feet', label: 'Feet' },
                            { id: 'heel', label: 'Heel' }
                          ].map(loc => {
                            const currentVal = editingProfile.painLocationsDetailed?.[loc.id] || 'None';
                            return (
                              <div key={loc.id} className="flex items-center justify-between py-1 pl-2 border-t border-slate-200/60 text-xs">
                                <span className="font-bold text-slate-800 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-900 inline-block"></span>
                                  {loc.label}:
                                </span>
                                <div className="flex items-center space-x-4 pr-2">
                                  {['Right', 'Left', 'Bilateral'].map(opt => (
                                    <label key={opt} className="flex items-center space-x-1 cursor-pointer">
                                      <input 
                                        type="radio"
                                        name={`exact_limb_${loc.id}`}
                                        className="text-optm-green focus:ring-optm-green w-3.5 h-3.5"
                                        checked={currentVal === opt}
                                        onChange={() => {
                                          const updatedDetailed = { ...(editingProfile.painLocationsDetailed || {}), [loc.id]: opt };
                                          setEditingProfile({ ...editingProfile, painLocationsDetailed: updatedDetailed });
                                        }}
                                      />
                                      <span className="font-semibold text-slate-700 text-[11px]">{opt}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                    </fieldset> 
  </div>
  <div className="flex-shrink-0 flex items-center justify-end space-x-2 p-3 bg-white border-t border-slate-200 shadow-[0_-8px_20px_rgba(0,0,0,0.04)] z-10">
    <button 
      type="button" 
      onClick={handleCloseProfileEdit}
      className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-100 transition text-xs cursor-pointer"
    >
      {isDemographicsLocked && originalProfile ? 'Close View' : 'Cancel'}
    </button>
    {(!originalProfile || !isDemographicsLocked) && (
      <button 
        type="submit" 
        className="px-5 py-1.5 rounded-xl bg-optm-green text-white font-black text-xs shadow-md hover:bg-opacity-95 transition active:scale-95 flex items-center space-x-1.5 cursor-pointer"
      >
        <CheckCircle className="w-3.5 h-3.5 text-optm-goldenrod" />
        <span>{originalProfile ? 'Update Record' : 'Register Patient'}</span>
      </button>
    )}
  </div>
</form>
                </div>
              </div>
            )}
      </main>
      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="relative bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
            <div className="h-2 w-full bg-gradient-to-r from-optm-green via-optm-goldenrod to-optm-green"></div>
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto shadow-sm">
                <LogOut className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">End Active Session?</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                  You are currently signed in as <strong className="text-slate-800">{currentUser?.name}</strong>. Are you sure you want to sign out?
                </p>
              </div>
              <div className="text-left space-y-1 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/70">
                <label className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider block">
                  Shift Handover / Logout Note <span className="font-normal text-slate-400 lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Completed token OPD batch..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-optm-green"
                  value={logoutNote}
                  onChange={e => setLogoutNote(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-xs transition cursor-pointer"
                >
                  Stay Logged In
                </button>
                <button
                  type="button"
                  onClick={confirmLogout}
                  className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAuditModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[110] flex items-center justify-center p-3 md:p-6">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[88vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-fade-in">
            <div className="bg-optm-green text-white px-5 py-3.5 flex items-center justify-between border-b border-white/10 flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                  <History className="w-4 h-4 text-optm-goldenrod" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">System Activity & Audit Trail</h3>
                  <p className="text-[10px] text-optm-goldenrod font-medium">Full log of payment updates, status changes, and profile edits</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={fetchAuditLogs}
                  title="Refresh Logs"
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer text-xs flex items-center gap-1 font-bold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAuditLogs ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAuditModal(false)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="relative flex-grow max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by staff name, action, token (e.g. OPTM-1)..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-optm-green"
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-500 font-mono">
                {auditLogsList.length} Total Logs
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 space-y-2">
              {loadingAuditLogs ? (
                <div className="p-12 text-center text-xs font-bold text-slate-400">Loading audit trail records...</div>
              ) : (() => {
                const filtered = auditLogsList.filter(l => 
                  (l.performedBy || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
                  (l.action || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
                  (l.details || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
                  (l.patientRegNo || '').toLowerCase().includes(auditSearch.toLowerCase())
                );
                if (filtered.length === 0) {
                  return (
                    <div className="p-12 text-center space-y-1">
                      <p className="text-xs font-bold text-slate-700">No activity logs found</p>
                      <p className="text-[10px] text-slate-400">Logs are recorded automatically whenever payments or statuses are updated.</p>
                    </div>
                  );
                }
                return filtered.map((log) => (
                  <div key={log.id} className="pt-2.5 pb-2 text-xs flex flex-col sm:flex-row sm:items-start justify-between gap-2 hover:bg-slate-50/70 p-2 rounded-xl transition">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-extrabold text-slate-900 text-xs">{log.action}</span>
                        {log.patientRegNo && (
                          <span className="font-mono text-[10px] font-bold text-optm-green bg-optm-green/10 border border-optm-green/20 px-1.5 py-0.2 rounded">
                            {log.patientRegNo}
                          </span>
                        )}
                        <span className="text-[9.5px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          By: <strong className="text-slate-800">{log.performedBy}</strong>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                        {log.details}
                      </p>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium whitespace-nowrap sm:text-right flex-shrink-0 flex items-center sm:block gap-1">
                      <Clock className="w-3 h-3 text-slate-400 inline sm:hidden" />
                      <span>{log.timestamp}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-1.5 rounded-xl bg-optm-green text-white font-bold text-xs hover:bg-opacity-95 transition cursor-pointer"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedPatientLogs && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[120] flex items-center justify-center p-3 md:p-6">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-fade-in">
            <div className="bg-optm-green text-white px-5 py-3.5 flex items-center justify-between border-b border-white/10 flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-optm-goldenrod/20 flex items-center justify-center">
                  <History className="w-4 h-4 text-optm-goldenrod" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-black text-white capitalize">{selectedPatientLogs.firstName} {selectedPatientLogs.lastName}</h3>
                    <span className="bg-optm-goldenrod text-optm-green text-[9px] font-black px-1.5 py-0.2 rounded font-mono">
                      {selectedPatientLogs.regNo}
                    </span>
                  </div>
                  <p className="text-[10px] text-optm-goldenrod font-medium">Individual Patient Audit Trail & Detailed Change Log</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatientLogs(null)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs transition cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
              {(!selectedPatientLogs.activityLogs || selectedPatientLogs.activityLogs.length === 0) ? (
                <div className="p-12 text-center space-y-1">
                  <p className="text-xs font-bold text-slate-700">No changes logged yet for this patient</p>
                  <p className="text-[10px] text-slate-400">Any demographic edits, payment adjustments, or status changes will be recorded here with field-by-field diffs.</p>
                </div>
              ) : (
                [...selectedPatientLogs.activityLogs].reverse().map((log, idx) => (
                  <div key={log.id || idx} className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-1 border-b border-slate-100 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-xs text-slate-900">{log.action}</span>
                        <span className="text-[9.5px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          By: <strong className="text-optm-green font-extrabold">{log.performedBy}</strong> ({log.role})
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">{log.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">
                      {log.details}
                    </p>
                    {log.fieldChanges && log.fieldChanges.length > 0 && (
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 space-y-1.5">
                        <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block">
                          Detailed Modifications ({log.fieldChanges.length}):
                        </span>
                        <div className="space-y-1">
                          {log.fieldChanges.map((change, cIdx) => (
                            <div key={cIdx} className="grid grid-cols-12 gap-2 text-[10.5px] items-center bg-white p-1.5 rounded-lg border border-slate-150">
                              <span className="col-span-4 font-bold text-slate-700 truncate">{change.field}:</span>
                              <div className="col-span-8 flex items-center space-x-1.5 min-w-0">
                                <span className="bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.2 rounded line-through truncate max-w-[45%] font-medium">
                                  {change.from}
                                </span>
                                <span className="text-slate-400 font-bold">→</span>
                                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-bold truncate max-w-[45%]">
                                  {change.to}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedPatientLogs(null)}
                className="px-4 py-1.5 rounded-xl bg-optm-green text-white font-bold text-xs hover:bg-opacity-95 transition cursor-pointer"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
      {showUndoPinModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
          <div className="relative bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
            <div className="h-2 w-full bg-red-600"></div>
            <form onSubmit={confirmUndoPayment} className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center mx-auto shadow-sm">
                <Lock className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-black text-slate-900">Authorize Payment Undo</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {undoTargetType === 'opd' 
                    ? 'Enter supervisor password to revert this OPD fee back to Unpaid status.' 
                    : 'Enter supervisor password to revert this package payment back to Prescribed status.'}
                </p>
              </div>
              {undoPinError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold px-3 py-2 rounded-xl text-center">
                  {undoPinError}
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Supervisor Password / PIN</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoFocus
                    placeholder="Enter password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    value={undoAdminPin}
                    onChange={e => setUndoAdminPin(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-500" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowUndoPinModal(false);
                    setUndoTargetPatientId(null);
                    setUndoAdminPin('');
                  }}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer active:scale-95"
                >
                  Confirm Undo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showDiscardConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full p-4 shadow-2xl border border-slate-200 text-center animate-fade-in space-y-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">Unsaved Changes</h4>
              <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                You have unsaved changes. Are you sure you want to discard them?
              </p>
            </div>
            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="w-1/2 py-1.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={confirmDiscardChanges}
                className="w-1/2 py-1.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow transition cursor-pointer"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
      {showPaymentModal && activePaymentPatient && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[220] flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-150 overflow-hidden animate-fade-in relative">
            <div className="h-1.5 w-full bg-optm-green"></div>
            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-[10px] transition cursor-pointer z-10"
            >
              ✕
            </button>
            <div className="p-3.5 space-y-2.5">
              <div className="text-center space-y-0.5 border-b border-slate-100 pb-2">
                <span className="text-[8.5px] font-black uppercase text-optm-green tracking-widest block">Secure Billing Gateway</span>
                <h3 className="text-sm font-bold text-slate-900 capitalize">
                  {activePaymentPatient.firstName} {activePaymentPatient.lastName}
                </h3>
                <span className="inline-block font-mono text-[9px] font-bold text-optm-green bg-optm-green/10 px-2 py-0.2 rounded">
                  Token: {activePaymentPatient.regNo}
                </span>
              </div>
              <div className="bg-slate-50/50 border border-slate-200/70 rounded-xl p-2.5 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-bold uppercase text-slate-400 block tracking-wider">Selected Package</span>
                    <span className="text-slate-900 font-extrabold text-[11.5px] leading-tight block">
                      {activePaymentPatient.prescription?.packageName}
                    </span>
                  </div>
                  {activePaymentPatient.prescription?.sittings && (
                    <span className="flex-shrink-0 inline-flex items-center bg-optm-green/10 text-optm-green text-[9.5px] font-extrabold px-2 py-0.5 rounded-lg border border-optm-green/20">
                      📅 {activePaymentPatient.prescription.sittings} Sittings
                    </span>
                  )}
                </div>
                <div className="border-t border-slate-150/60 pt-1.5 space-y-1">
                  <div className="flex justify-between items-center text-slate-500">
                    <span className="text-[9.5px] font-bold uppercase">Total Cost:</span>
                    <span className="font-mono font-black text-slate-800 text-xs">₹{(activePaymentPatient.prescription?.cost || 0).toLocaleString('en-IN')}</span>
                  </div>
                  {activePaymentPatient.remainingBalance > 0 && (
                    <div className="flex justify-between items-center text-amber-700 bg-amber-50/30 px-1.5 py-0.5 rounded border border-amber-100/60">
                      <span className="text-[9.5px] font-black uppercase">Balance Due:</span>
                      <span className="font-mono font-black text-xs">₹{activePaymentPatient.remainingBalance.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                {paymentError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold px-2 py-1 rounded-xl text-center animate-fade-in">
                    {paymentError}
                  </div>
                )}
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-8 space-y-0.5">
                    <label className="block text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">Amount (₹)</label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Enter amount"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-2.5 pr-16 py-1.5 text-xs text-slate-900 font-mono font-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green"
                        value={customPayAmount || ''}
                        onChange={e => {
                          setPaymentError('');
                          setCustomPayAmount(parseFloat(e.target.value) || 0);
                        }}
                      />
                      {!activePaymentPatient.remainingBalance ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentError('');
                            setCustomPayAmount(activePaymentPatient.prescription?.cost || 0);
                          }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8.5px] font-black uppercase text-white bg-optm-green hover:bg-opacity-95 px-1.5 py-0.5 rounded-lg shadow-2xs transition cursor-pointer"
                        >
                          Set Full
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentError('');
                            setCustomPayAmount(activePaymentPatient.remainingBalance || 0);
                          }}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8.5px] font-black uppercase text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-1.5 py-0.5 rounded-lg shadow-2xs transition cursor-pointer"
                        >
                          Set Due
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="col-span-4 space-y-0.5">
                    <label className="block text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">Method</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-optm-green cursor-pointer"
                      value={selectedPayMethod}
                      onChange={e => setSelectedPayMethod(e.target.value)}
                    >
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Debit Card">Debit Card</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="py-1.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-extrabold text-[11px] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentError('');
                    const totalCost = activePaymentPatient.prescription?.cost || 0;
                    const enteredAmount = customPayAmount || 0;
                    const maxAllowed = activePaymentPatient.remainingBalance > 0 
                      ? activePaymentPatient.remainingBalance 
                      : totalCost;
                    if (enteredAmount <= 0) {
                      setPaymentError('Please enter a valid amount.');
                      return;
                    }
                    if (enteredAmount > maxAllowed) {
                      setPaymentError(`Amount cannot exceed the limit of ₹${maxAllowed.toLocaleString('en-IN')}.`);
                      return;
                    }
                    const existingPaid = activePaymentPatient.paidAmount || 0;
                    const newTotalPaid = existingPaid + (activePaymentPatient.remainingBalance ? enteredAmount : enteredAmount);
                    if (!activePaymentPatient.paidAmount && enteredAmount >= totalCost) {
                      handleFinalCheckout(activePaymentPatient.id, selectedPayMethod, totalCost);
                    } else if (activePaymentPatient.remainingBalance > 0) {
                      handlePayInstallment(activePaymentPatient.id, enteredAmount);
                    } else {
                      handlePartialCheckout(activePaymentPatient.id, enteredAmount, selectedPayMethod);
                    }
                    setShowPaymentModal(false);
                  }}
                  className="py-1.5 px-3 rounded-xl bg-optm-green hover:bg-opacity-95 text-white font-extrabold text-[11px] shadow-sm transition cursor-pointer active:scale-95"
                >
                  Confirm Collection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <footer className="bg-white border-t border-optm-gray py-4 px-4 text-center text-xs text-optm-green/60 mt-8">
        OPTM HEALTHCARE Integrated Billing & EMR System &copy; 2026.
      </footer>
      {toast.show && (
        <div 
          className="fixed bottom-6 right-6 z-50 flex flex-col"
          style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
        >
          <style>{`
            @keyframes slideUp {
              from { transform: translateY(30px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
          <div className="bg-optm-green/95 backdrop-blur-md text-white py-4 px-5 rounded-2xl shadow-sm border border-optm-gray/40 flex items-center space-x-3.5 max-w-sm">
            <div className="w-6.5 h-6.5 rounded-full bg-optm-goldenrod/20 text-optm-goldenrod flex items-center justify-center flex-shrink-0 border border-optm-goldenrod/10">
              <CheckCircle className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold tracking-wide text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}