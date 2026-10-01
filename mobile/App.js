import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import { api, clearTokens, getTokens, setTokens } from './src/api/client';

const AuthContext = createContext(null);
const RootStack = createNativeStackNavigator();
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const todayISO = () => new Date().toISOString().slice(0, 10);
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const mealLabel = (plan) => (plan === 'TWO_TIME' ? '2-Time' : '1-Time');

function normalizeMobile(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits;
}

function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    async function restore() {
      const tokens = await getTokens();
      if (tokens.access) {
        try {
          const data = await api.get('/profile');
          setUser(data.profile);
        } catch {
          await clearTokens();
        }
      }
      setBooting(false);
    }
    restore();
  }, []);

  const value = useMemo(() => ({
    user,
    booting,
    async login(emailOrMobile, password) {
      const data = await api.post('/auth/login', {
        email_or_mobile: emailOrMobile,
        password,
      });
      await setTokens(data);
      const profile = await api.get('/profile');
      setUser(profile.profile);
    },
    async register(form) {
      await api.post('/auth/register', {
        owner_name: form.owner_name,
        mess_name: form.mess_name,
        mobile: normalizeMobile(form.mobile),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        fee_one_time: Number(form.fee_one_time),
        fee_two_time: Number(form.fee_two_time),
      });
    },
    async refreshProfile() {
      const data = await api.get('/profile');
      setUser(data.profile);
      return data.profile;
    },
    async logout() {
      try {
        await api.post('/auth/logout', {});
      } catch {
        // Token may already be expired; local cleanup is still required.
      }
      await clearTokens();
      setUser(null);
    },
  }), [user, booting]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Screen({ children, refreshing = false, onRefresh }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', secureTextEntry = false, multiline = false }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        multiline={multiline}
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

function Button({ title, onPress, variant = 'primary', disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        (pressed || disabled) && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, variant === 'secondary' && styles.secondaryButtonText]}>{title}</Text>
    </Pressable>
  );
}

function ErrorText({ message }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color="#16884e" />
      <Text style={styles.muted}>Loading...</Text>
    </View>
  );
}

function StatCard({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function AuthShell({ title, subtitle, children }) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.authWrap}>
        <ScrollView contentContainerStyle={styles.authScreen} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>MessDesk</Text>
          <Text style={styles.authTitle}>{title}</Text>
          <Text style={styles.authSub}>{subtitle}</Text>
          <View style={styles.authCard}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LoginScreen({ navigation }) {
  const auth = useAuth();
  const [emailOrMobile, setEmailOrMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    try {
      await auth.login(emailOrMobile, password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Owner Login" subtitle="Sign in to manage your mess from Android.">
      <ErrorText message={error} />
      <Field label="Email or mobile" value={emailOrMobile} onChangeText={setEmailOrMobile} placeholder="you@gmail.com" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" />
      <Button title={loading ? 'Signing in...' : 'Login'} onPress={submit} disabled={loading} />
      <Button title="Create owner account" variant="secondary" onPress={() => navigation.navigate('Register')} />
    </AuthShell>
  );
}

function RegisterScreen({ navigation }) {
  const auth = useAuth();
  const [form, setForm] = useState({
    owner_name: '',
    mess_name: '',
    mobile: '',
    email: '',
    password: '',
    fee_one_time: '',
    fee_two_time: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const update = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  async function submit() {
    setError('');
    setLoading(true);
    try {
      await auth.register(form);
      await auth.login(form.email, form.password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Owner Registration" subtitle="Create your mess owner workspace.">
      <ErrorText message={error} />
      <Field label="Owner name" value={form.owner_name} onChangeText={update('owner_name')} />
      <Field label="Mess name" value={form.mess_name} onChangeText={update('mess_name')} />
      <Field label="Mobile" value={form.mobile} onChangeText={update('mobile')} keyboardType="phone-pad" />
      <Field label="Gmail address" value={form.email} onChangeText={update('email')} keyboardType="email-address" placeholder="owner@gmail.com" />
      <Field label="Password" value={form.password} onChangeText={update('password')} secureTextEntry />
      <Field label="1-Time monthly fee" value={form.fee_one_time} onChangeText={update('fee_one_time')} keyboardType="numeric" />
      <Field label="2-Time monthly fee" value={form.fee_two_time} onChangeText={update('fee_two_time')} keyboardType="numeric" />
      <Button title={loading ? 'Creating...' : 'Create account'} onPress={submit} disabled={loading} />
      <Button title="Back to login" variant="secondary" onPress={() => navigation.goBack()} />
    </AuthShell>
  );
}

function DashboardScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      setError('');
      const res = await api.get('/dashboard');
      setData(res);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text style={styles.title}>Dashboard</Text>
      <ErrorText message={error} />
      {!data ? <Loading /> : (
        <>
          <View style={styles.statGrid}>
            <StatCard label="Total Students" value={data.total_students} />
            <StatCard label="Active" value={data.active_students} />
            <StatCard label="Ending Soon" value={data.ending_soon} />
            <StatCard label="Expired" value={data.expired} />
            <StatCard label="On Holiday" value={data.on_holiday} />
            <StatCard label="Ending Today" value={data.ending_today} />
          </View>
          <View style={styles.card}>
            <InfoRow label="Total fees" value={money(data.total_fees)} />
            <InfoRow label="Collected" value={money(data.total_collected)} />
            <InfoRow label="Remaining" value={money(data.total_remaining)} />
          </View>
          <View style={styles.actions}>
            <Button title="Add Student" onPress={() => navigation.navigate('StudentsTab', { screen: 'AddStudent' })} />
            <Button title="Record Payment" variant="secondary" onPress={() => navigation.navigate('StudentsTab', { screen: 'AddPayment' })} />
          </View>
        </>
      )}
    </Screen>
  );
}

function StudentCard({ student, onPress }) {
  return (
    <Pressable style={styles.listCard} onPress={onPress}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{student.name}</Text>
          <Text style={styles.muted}>{student.mobile}</Text>
          <Text style={styles.small}>{mealLabel(student.meal_plan)} · Ends {student.current_end_date}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.badge}>{student.status}</Text>
          <Text style={styles.due}>{money(student.remaining_amount)} due</Text>
        </View>
      </View>
    </Pressable>
  );
}

function StudentListScreen({ navigation }) {
  const [students, setStudents] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const res = await api.get(`/students?${params.toString()}`);
      setStudents(res.students);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [search, status]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.listHeader}>
        <Text style={styles.title}>Student List</Text>
        <Button title="Add" onPress={() => navigation.navigate('AddStudent')} />
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="Name or mobile" />
        <View style={styles.segment}>
          {['', 'ACTIVE', 'ENDING_SOON', 'EXPIRED', 'ON_HOLIDAY'].map((s) => (
            <Pressable key={s || 'ALL'} style={[styles.segmentItem, status === s && styles.segmentActive]} onPress={() => setStatus(s)}>
              <Text style={[styles.segmentText, status === s && styles.segmentTextActive]}>{s || 'ALL'}</Text>
            </Pressable>
          ))}
        </View>
        <ErrorText message={error} />
      </View>
      {!students ? <Loading /> : (
        <FlatList
          data={students}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={<Text style={styles.empty}>No students found.</Text>}
          renderItem={({ item }) => <StudentCard student={item} onPress={() => navigation.navigate('StudentDetails', { id: item.id })} />}
        />
      )}
    </SafeAreaView>
  );
}

function AddStudentScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    start_date: todayISO(),
    plan_days: '30',
    meal_plan: 'ONE_TIME',
    total_fee: '',
    amount_paid: '0',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  useEffect(() => {
    api.get('/profile').then((res) => {
      setProfile(res.profile);
      setForm((f) => ({ ...f, total_fee: String(res.profile.fee_one_time || '') }));
    }).catch((e) => setError(e.message));
  }, []);

  function setPlan(plan) {
    const fee = plan === 'TWO_TIME' ? profile?.fee_two_time : profile?.fee_one_time;
    setForm((f) => ({ ...f, meal_plan: plan, total_fee: fee ? String(fee) : f.total_fee }));
  }

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await api.post('/students', {
        name: form.name,
        mobile: normalizeMobile(form.mobile),
        start_date: form.start_date,
        plan_days: Number(form.plan_days),
        meal_plan: form.meal_plan,
        total_fee: Number(form.total_fee),
        amount_paid: Number(form.amount_paid || 0),
      });
      navigation.replace('StudentList');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Add Student</Text>
      <ErrorText message={error} />
      <Field label="Name" value={form.name} onChangeText={update('name')} />
      <Field label="Mobile" value={form.mobile} onChangeText={update('mobile')} keyboardType="phone-pad" />
      <Field label="Start date" value={form.start_date} onChangeText={update('start_date')} placeholder="YYYY-MM-DD" />
      <Field label="Plan days" value={form.plan_days} onChangeText={update('plan_days')} keyboardType="numeric" />
      <View style={styles.segment}>
        {['ONE_TIME', 'TWO_TIME'].map((p) => (
          <Pressable key={p} style={[styles.segmentItem, form.meal_plan === p && styles.segmentActive]} onPress={() => setPlan(p)}>
            <Text style={[styles.segmentText, form.meal_plan === p && styles.segmentTextActive]}>{mealLabel(p)}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Total fee" value={form.total_fee} onChangeText={update('total_fee')} keyboardType="numeric" />
      <Field label="Amount paid" value={form.amount_paid} onChangeText={update('amount_paid')} keyboardType="numeric" />
      <Button title={saving ? 'Saving...' : 'Save Student'} onPress={submit} disabled={saving} />
    </Screen>
  );
}

function StudentDetailsScreen({ route, navigation }) {
  const { id } = route.params;
  const [student, setStudent] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const res = await api.get(`/students/${id}`);
      setStudent(res.student);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, id]);

  async function remove() {
    Alert.alert('Remove student?', 'This marks the student as left mess.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await api.del(`/students/${id}`);
          navigation.popToTop();
        },
      },
    ]);
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ErrorText message={error} />
      {!student ? <Loading /> : (
        <>
          <Text style={styles.title}>Student Details</Text>
          <View style={styles.card}>
            <Text style={styles.bigName}>{student.name}</Text>
            <Text style={styles.muted}>{student.mobile}</Text>
            <Text style={styles.badge}>{student.status}</Text>
          </View>
          <View style={styles.card}>
            <InfoRow label="Meal plan" value={mealLabel(student.meal_plan)} />
            <InfoRow label="Start date" value={student.start_date} />
            <InfoRow label="Original end" value={student.original_end_date} />
            <InfoRow label="Current end" value={student.current_end_date} />
            <InfoRow label="Plan days" value={student.plan_days} />
            <InfoRow label="Holiday days" value={student.total_holiday_days} />
          </View>
          <View style={styles.card}>
            <InfoRow label="Total fee" value={money(student.total_fee)} />
            <InfoRow label="Paid" value={money(student.total_paid)} />
            <InfoRow label="Remaining" value={money(student.remaining_amount)} />
          </View>
          <View style={styles.actions}>
            <Button title="Edit Student" onPress={() => navigation.navigate('EditStudent', { id })} />
            <Button title="Add Payment" variant="secondary" onPress={() => navigation.navigate('AddPayment', { studentId: id })} />
            <Button title="Add Holiday" variant="secondary" onPress={() => navigation.navigate('AddHoliday', { studentId: id })} />
            <Button title="Remove Student" variant="danger" onPress={remove} />
          </View>
          <Text style={styles.sectionTitle}>Payment History</Text>
          {(student.payments || []).map((p) => (
            <View key={p.id} style={styles.listCard}>
              <InfoRow label={`${p.payment_date} · ${p.payment_method}`} value={money(p.amount)} />
              {!!p.note && <Text style={styles.muted}>{p.note}</Text>}
            </View>
          ))}
          <Text style={styles.sectionTitle}>Holiday History</Text>
          {(student.holidays || []).map((h) => (
            <View key={h.id} style={styles.listCard}>
              <InfoRow label={`${h.start_date} to ${h.end_date}`} value={`${h.number_of_days} days`} />
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

function EditStudentScreen({ route, navigation }) {
  const { id } = route.params;
  const [form, setForm] = useState({ name: '', mobile: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/students/${id}`).then((res) => {
      setForm({ name: res.student.name, mobile: res.student.mobile });
    }).catch((e) => setError(e.message));
  }, [id]);

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await api.put(`/students/${id}`, { name: form.name, mobile: normalizeMobile(form.mobile) });
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Edit Student</Text>
      <ErrorText message={error} />
      <Field label="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
      <Field label="Mobile" value={form.mobile} onChangeText={(v) => setForm((f) => ({ ...f, mobile: v }))} keyboardType="phone-pad" />
      <Button title={saving ? 'Saving...' : 'Save Changes'} onPress={submit} disabled={saving} />
    </Screen>
  );
}

function SelectStudent({ students, value, onChange }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Student</Text>
      <View style={styles.selectList}>
        {students.map((s) => (
          <Pressable key={s.id} onPress={() => onChange(String(s.id))} style={[styles.selectItem, String(value) === String(s.id) && styles.selectActive]}>
            <Text style={String(value) === String(s.id) ? styles.selectTextActive : styles.selectText}>{s.name}</Text>
            <Text style={styles.small}>{money(Math.max(0, s.total_fee - s.total_paid))} due</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function AddPaymentScreen({ route, navigation }) {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    student_id: route.params?.studentId ? String(route.params.studentId) : '',
    amount: '',
    payment_date: todayISO(),
    payment_method: 'CASH',
    note: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/students').then((res) => setStudents(res.students)).catch((e) => setError(e.message));
  }, []);

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await api.post('/payments', {
        student_id: Number(form.student_id),
        amount: Number(form.amount),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        note: form.note,
      });
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Add Payment</Text>
      <ErrorText message={error} />
      <SelectStudent students={students} value={form.student_id} onChange={(v) => setForm((f) => ({ ...f, student_id: v }))} />
      <Field label="Amount" value={form.amount} onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))} keyboardType="numeric" />
      <Field label="Payment date" value={form.payment_date} onChangeText={(v) => setForm((f) => ({ ...f, payment_date: v }))} />
      <View style={styles.segment}>
        {['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'].map((m) => (
          <Pressable key={m} style={[styles.segmentItem, form.payment_method === m && styles.segmentActive]} onPress={() => setForm((f) => ({ ...f, payment_method: m }))}>
            <Text style={[styles.segmentText, form.payment_method === m && styles.segmentTextActive]}>{m}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Note" value={form.note} onChangeText={(v) => setForm((f) => ({ ...f, note: v }))} multiline />
      <Button title={saving ? 'Saving...' : 'Record Payment'} onPress={submit} disabled={saving} />
    </Screen>
  );
}

function PaymentHistoryScreen({ navigation }) {
  const [payments, setPayments] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [p, s] = await Promise.all([api.get('/payments'), api.get('/students')]);
      setPayments(p.payments);
      setStudents(s.students);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const studentName = (id) => students.find((s) => s.id === id)?.name || `#${id}`;

  return (
    <Screen onRefresh={load} refreshing={false}>
      <Text style={styles.title}>Payment History</Text>
      <Button title="Add Payment" onPress={() => navigation.navigate('AddPayment')} variant="secondary" />
      <ErrorText message={error} />
      {!payments ? <Loading /> : payments.map((p) => (
        <View key={p.id} style={styles.listCard}>
          <InfoRow label={studentName(p.student_id)} value={money(p.amount)} />
          <Text style={styles.muted}>{p.payment_date} · {p.payment_method}</Text>
          {!!p.note && <Text style={styles.small}>{p.note}</Text>}
        </View>
      ))}
    </Screen>
  );
}

function PaymentHistoryStackScreen({ navigation }) {
  const [payments, setPayments] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [p, s] = await Promise.all([api.get('/payments'), api.get('/students')]);
      setPayments(p.payments);
      setStudents(s.students);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation]);

  const studentName = (id) => students.find((s) => s.id === id)?.name || `#${id}`;

  return (
    <Screen>
      <Text style={styles.title}>Payment History</Text>
      <Button title="Add Payment" onPress={() => navigation.navigate('AddPayment')} />
      <ErrorText message={error} />
      {!payments ? <Loading /> : payments.map((p) => (
        <View key={p.id} style={styles.listCard}>
          <InfoRow label={studentName(p.student_id)} value={money(p.amount)} />
          <Text style={styles.muted}>{p.payment_date} · {p.payment_method}</Text>
          {!!p.note && <Text style={styles.small}>{p.note}</Text>}
        </View>
      ))}
    </Screen>
  );
}

function HolidayListScreen({ navigation }) {
  const [holidays, setHolidays] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [h, s] = await Promise.all([api.get('/holidays'), api.get('/students')]);
      setHolidays(h.holidays);
      setStudents(s.students);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation]);

  const studentName = (id) => students.find((s) => s.id === id)?.name || `#${id}`;

  return (
    <Screen>
      <Text style={styles.title}>Holiday List</Text>
      <Button title="Add Holiday" onPress={() => navigation.navigate('AddHoliday')} />
      <ErrorText message={error} />
      {!holidays ? <Loading /> : holidays.map((h) => (
        <View key={h.id} style={styles.listCard}>
          <InfoRow label={studentName(h.student_id)} value={`${h.number_of_days} days`} />
          <Text style={styles.muted}>{h.start_date} to {h.end_date}</Text>
        </View>
      ))}
    </Screen>
  );
}

function AddHolidayScreen({ route, navigation }) {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    student_id: route.params?.studentId ? String(route.params.studentId) : '',
    start_date: todayISO(),
    end_date: todayISO(),
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/students').then((res) => setStudents(res.students)).catch((e) => setError(e.message));
  }, []);

  async function submit() {
    setSaving(true);
    setError('');
    try {
      await api.post('/holidays', {
        student_id: Number(form.student_id),
        start_date: form.start_date,
        end_date: form.end_date,
      });
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Add Holiday</Text>
      <ErrorText message={error} />
      <SelectStudent students={students} value={form.student_id} onChange={(v) => setForm((f) => ({ ...f, student_id: v }))} />
      <Field label="Start date" value={form.start_date} onChangeText={(v) => setForm((f) => ({ ...f, start_date: v }))} />
      <Field label="End date" value={form.end_date} onChangeText={(v) => setForm((f) => ({ ...f, end_date: v }))} />
      <Button title={saving ? 'Saving...' : 'Record Holiday'} onPress={submit} disabled={saving} />
    </Screen>
  );
}

function NotificationsScreen() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await api.get('/notifications');
      setItems(res.notifications);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markAll() {
    await api.put('/notifications/read-all', {});
    load();
  }

  return (
    <Screen>
      <Text style={styles.title}>Notifications</Text>
      <Button title="Mark all read" variant="secondary" onPress={markAll} />
      <ErrorText message={error} />
      {!items ? <Loading /> : items.map((n) => (
        <View key={n.id} style={[styles.listCard, !n.is_read && styles.unreadCard]}>
          <Text style={styles.cardTitle}>{n.title}</Text>
          <Text style={styles.muted}>{n.message}</Text>
          <Text style={styles.small}>{n.created_at}</Text>
        </View>
      ))}
    </Screen>
  );
}

function ReportsScreen() {
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await api.get(`/reports/monthly?year=${Number(year)}&month=${Number(month)}`);
      setReport(res);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Screen>
      <Text style={styles.title}>Reports</Text>
      <View style={styles.row}>
        <View style={styles.flex}><Field label="Year" value={year} onChangeText={setYear} keyboardType="numeric" /></View>
        <View style={styles.flex}><Field label="Month" value={month} onChangeText={setMonth} keyboardType="numeric" /></View>
      </View>
      <Button title="Load Report" onPress={load} />
      <ErrorText message={error} />
      {report && (
        <View style={styles.card}>
          <InfoRow label="Period" value={report.period} />
          <InfoRow label="Active students" value={report.active_students} />
          <InfoRow label="New students" value={report.new_students} />
          <InfoRow label="Expired students" value={report.expired_students} />
          <InfoRow label="Collection" value={money(report.total_collection)} />
          <InfoRow label="Pending payments" value={money(report.pending_payments)} />
          <InfoRow label="Holiday days" value={report.total_holiday_days} />
          <InfoRow label="Renewals" value={report.renewals} />
        </View>
      )}
    </Screen>
  );
}

function ProfileScreen() {
  const auth = useAuth();
  const [form, setForm] = useState({
    owner_name: '',
    mess_name: '',
    fee_one_time: '',
    fee_two_time: '',
  });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    auth.refreshProfile().then((p) => setForm({
      owner_name: p.owner_name || '',
      mess_name: p.mess_name || '',
      fee_one_time: String(p.fee_one_time || ''),
      fee_two_time: String(p.fee_two_time || ''),
    })).catch((e) => setError(e.message));
  }, []);

  async function saveProfile() {
    setError('');
    setMessage('');
    try {
      await api.put('/profile', {
        owner_name: form.owner_name,
        mess_name: form.mess_name,
        fee_one_time: Number(form.fee_one_time),
        fee_two_time: Number(form.fee_two_time),
      });
      await auth.refreshProfile();
      setMessage('Profile updated');
    } catch (e) {
      setError(e.message);
    }
  }

  async function changePassword() {
    setError('');
    setMessage('');
    try {
      await api.put('/profile/password', passwords);
      setPasswords({ current_password: '', new_password: '' });
      setMessage('Password updated');
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Profile / Settings</Text>
      <ErrorText message={error} />
      {!!message && <Text style={styles.success}>{message}</Text>}
      <View style={styles.card}>
        <InfoRow label="Email" value={auth.user?.email || ''} />
        <InfoRow label="Mobile" value={auth.user?.mobile || ''} />
      </View>
      <Field label="Owner name" value={form.owner_name} onChangeText={(v) => setForm((f) => ({ ...f, owner_name: v }))} />
      <Field label="Mess name" value={form.mess_name} onChangeText={(v) => setForm((f) => ({ ...f, mess_name: v }))} />
      <Field label="1-Time fee" value={form.fee_one_time} onChangeText={(v) => setForm((f) => ({ ...f, fee_one_time: v }))} keyboardType="numeric" />
      <Field label="2-Time fee" value={form.fee_two_time} onChangeText={(v) => setForm((f) => ({ ...f, fee_two_time: v }))} keyboardType="numeric" />
      <Button title="Save Settings" onPress={saveProfile} />
      <Text style={styles.sectionTitle}>Change Password</Text>
      <Field label="Current password" value={passwords.current_password} onChangeText={(v) => setPasswords((p) => ({ ...p, current_password: v }))} secureTextEntry />
      <Field label="New password" value={passwords.new_password} onChangeText={(v) => setPasswords((p) => ({ ...p, new_password: v }))} secureTextEntry />
      <Button title="Update Password" variant="secondary" onPress={changePassword} />
      <Button title="Logout" variant="danger" onPress={auth.logout} />
    </Screen>
  );
}

function StudentsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="StudentList" component={StudentListScreen} options={{ title: 'Students' }} />
      <Stack.Screen name="AddStudent" component={AddStudentScreen} options={{ title: 'Add Student' }} />
      <Stack.Screen name="StudentDetails" component={StudentDetailsScreen} options={{ title: 'Student Details' }} />
      <Stack.Screen name="EditStudent" component={EditStudentScreen} options={{ title: 'Edit Student' }} />
      <Stack.Screen name="AddPayment" component={AddPaymentScreen} options={{ title: 'Add Payment' }} />
      <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} options={{ title: 'Payment History' }} />
      <Stack.Screen name="HolidayList" component={HolidayListScreen} options={{ title: 'Holidays' }} />
      <Stack.Screen name="AddHoliday" component={AddHolidayScreen} options={{ title: 'Add Holiday' }} />
    </Stack.Navigator>
  );
}

function PaymentsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="PaymentHistory" component={PaymentHistoryStackScreen} options={{ title: 'Payment History' }} />
      <Stack.Screen name="AddPayment" component={AddPaymentScreen} options={{ title: 'Add Payment' }} />
    </Stack.Navigator>
  );
}

function HolidaysStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HolidayList" component={HolidayListScreen} options={{ title: 'Holidays' }} />
      <Stack.Screen name="AddHoliday" component={AddHolidayScreen} options={{ title: 'Add Holiday' }} />
    </Stack.Navigator>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#16884e',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6 },
      }}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="StudentsTab" component={StudentsStack} options={{ title: 'Students' }} />
      <Tab.Screen name="Payments" component={PaymentsStack} options={{ title: 'Payments' }} />
      <Tab.Screen name="Holidays" component={HolidaysStack} options={{ title: 'Holidays' }} />
      <Tab.Screen name="Alerts" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Settings" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Login" component={LoginScreen} />
      <RootStack.Screen name="Register" component={RegisterScreen} />
    </RootStack.Navigator>
  );
}

function AppRoot() {
  const auth = useAuth();
  if (auth.booting) {
    return (
      <SafeAreaView style={styles.safe}>
        <Loading />
      </SafeAreaView>
    );
  }
  return (
    <NavigationContainer>
      {auth.user ? <AppTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar barStyle="dark-content" />
      <ExpoStatusBar style="dark" />
      <AppRoot />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  authWrap: {
    flex: 1,
  },
  authScreen: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  screen: {
    padding: 16,
    paddingBottom: 36,
  },
  authCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  brand: {
    fontSize: 30,
    fontWeight: '800',
    color: '#16884e',
    marginBottom: 10,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  authSub: {
    color: '#64748b',
    marginTop: 4,
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 18,
    marginBottom: 8,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  multiline: {
    minHeight: 86,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  button: {
    minHeight: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16884e',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  dangerButton: {
    backgroundColor: '#dc2626',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: '#166534',
  },
  error: {
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontWeight: '600',
  },
  success: {
    color: '#166534',
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontWeight: '600',
  },
  muted: {
    color: '#64748b',
  },
  small: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 3,
  },
  loading: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
  },
  statLabel: {
    color: '#64748b',
    fontWeight: '700',
    marginTop: 3,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  unreadCard: {
    borderColor: '#16884e',
    backgroundColor: '#f0fdf4',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  bigName: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  due: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  infoLabel: {
    color: '#64748b',
    fontWeight: '700',
  },
  infoValue: {
    color: '#0f172a',
    fontWeight: '800',
    textAlign: 'right',
    flexShrink: 1,
  },
  actions: {
    marginTop: 4,
  },
  listHeader: {
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 40,
  },
  segment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  segmentItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#ffffff',
  },
  segmentActive: {
    backgroundColor: '#16884e',
    borderColor: '#16884e',
  },
  segmentText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 12,
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  selectList: {
    gap: 8,
  },
  selectItem: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    padding: 12,
  },
  selectActive: {
    borderColor: '#16884e',
    backgroundColor: '#f0fdf4',
  },
  selectText: {
    color: '#0f172a',
    fontWeight: '800',
  },
  selectTextActive: {
    color: '#166534',
    fontWeight: '900',
  },
});
