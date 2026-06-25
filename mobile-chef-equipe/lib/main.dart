import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ThemeController.init();
  runApp(const OuargazApp());
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const kPrimary = Color(0xFFDA1A1A);
const kSuccess = Color(0xFF00D97E);
const kWarning = Color(0xFFFF6B00);
const kInfo = Color(0xFF00A8E8);
const k12kg = Color(0xFF0066CC);
const k6kg = Color(0xFF00A854);
const k3kg = Color(0xFFFF8C00);
const kBg = Color(0xFF0A0E1A);
const kCard = Color(0xFF111827);
const kBorder = Color(0xFF1E293B);
const kMuted = Color(0xFF64748B);

// ─── THEME CONTROLLER ─────────────────────────────────────────────────────────
class ThemeController {
  static final ValueNotifier<bool> isDark = ValueNotifier(true);
  
  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    isDark.value = prefs.getBool('isDark') ?? true;
  }
  
  static void toggle() {
    isDark.value = !isDark.value;
    _save();
  }
  
  static Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('isDark', isDark.value);
  }
}

// ─── APP ──────────────────────────────────────────────────────────────────────
class OuargazApp extends StatelessWidget {
  const OuargazApp({Key? key}) : super(key: key);
  
  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: ThemeController.isDark,
      builder: (context, isDark, _) {
        return MaterialApp(
          title: 'OUARGAZ Chef Équipe',
          debugShowCheckedModeBanner: false,
          theme: _buildTheme(isDark),
          home: const AuthWrapper(),
        );
      },
    );
  }

  ThemeData _buildTheme(bool isDark) {
    if (isDark) {
      return ThemeData(
        colorScheme: const ColorScheme.dark(primary: kPrimary, surface: kBg),
        scaffoldBackgroundColor: kBg,
        appBarTheme: const AppBarTheme(
          backgroundColor: kCard,
          foregroundColor: Colors.white,
          elevation: 1,
        ),
        cardTheme: CardThemeData(
          color: kCard,
          elevation: 1,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: kBorder),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF1E2A3A),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: kBorder),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: kPrimary, width: 2),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: kCard,
          indicatorColor: kPrimary.withOpacity(0.15),
          iconTheme: const MaterialStatePropertyAll(IconThemeData(color: Colors.white)),
          labelTextStyle: const MaterialStatePropertyAll(TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
        ),
        useMaterial3: true,
      );
    } else {
      return ThemeData(
        colorScheme: const ColorScheme.light(primary: kPrimary),
        scaffoldBackgroundColor: Colors.white,
        appBarTheme: const AppBarTheme(backgroundColor: Color(0xFFFAFAFA)),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 1,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFFE5E7EB)),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFF5F5F5),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: kPrimary, width: 2),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: const Color(0xFFF3F4F6),
          indicatorColor: kPrimary.withOpacity(0.15),
          iconTheme: MaterialStateProperty.resolveWith((states) {
            if (states.contains(MaterialState.selected)) {
              return const IconThemeData(color: kPrimary);
            }
            return const IconThemeData(color: Color(0xFF64748B));
          }),
          labelTextStyle: MaterialStateProperty.resolveWith((states) {
            if (states.contains(MaterialState.selected)) {
              return const TextStyle(color: kPrimary, fontSize: 11, fontWeight: FontWeight.bold);
            }
            return const TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w500);
          }),
        ),
        useMaterial3: true,
      );
    }
  }
}

// ─── API SERVICE ─────────────────────────────────────────────────────────────
class ApiService {
  static String baseUrl = '';
  static String? _cookie;

  static Future<void> loadConfig() async {
    final prefs = await SharedPreferences.getInstance();
    baseUrl = prefs.getString('base_url') ?? '';
    _cookie = prefs.getString('session_cookie');
  }

  static Future<void> saveConfig(String url, String username, String password, String cookie) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('base_url', url);
    await prefs.setString('session_username', username);
    await prefs.setString('session_password', password);
    await prefs.setString('session_cookie', cookie);
    baseUrl = url;
    _cookie = cookie;
  }

  static Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_cookie != null) 'Cookie': _cookie!,
  };

  static Future<Map<String, dynamic>?> login(String url, String username, String password) async {
    try {
      final resp = await http.post(
        Uri.parse('$url/api/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': username, 'password': password}),
      ).timeout(const Duration(seconds: 10));
      if (resp.statusCode == 200) {
        final cookie = resp.headers['set-cookie'] ?? '';
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        if (data['user'] != null) {
          await saveConfig(url, username, password, cookie);
          return data['user'] as Map<String, dynamic>;
        }
      }
    } catch (_) {}
    return null;
  }

  static Future<List<Map<String, dynamic>>> getCamionsFile() async {
    try {
      final resp = await http.get(
        Uri.parse('$baseUrl/api/mouvements-camions?statut=EN_ATTENTE'),
        headers: _headers,
      ).timeout(const Duration(seconds: 8));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        return (data['camions'] as List).cast<Map<String, dynamic>>();
      }
    } catch (_) {}
    return [];
  }

  static Future<List<Map<String, dynamic>>> getCamionsInternes() async {
    try {
      final resp = await http.get(
        Uri.parse('$baseUrl/api/mouvements-camions?statut=TOUS'),
        headers: _headers,
      ).timeout(const Duration(seconds: 8));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        final all = (data['camions'] as List).cast<Map<String, dynamic>>();
        return all.where((c) => ['EN_COURS_TRAITEMENT', 'DEMARRAGE_EMPLISSAGE'].contains(c['statut'])).toList();
      }
    } catch (_) {}
    return [];
  }

  static Future<List<Map<String, dynamic>>> getCamionsPrets() async {
    try {
      final resp = await http.get(
        Uri.parse('$baseUrl/api/mouvements-camions?statut=PRET_A_SORTIR'),
        headers: _headers,
      ).timeout(const Duration(seconds: 8));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        return (data['camions'] as List).cast<Map<String, dynamic>>();
      }
    } catch (_) {}
    return [];
  }

  static Future<List<Map<String, dynamic>>> getHistorique(String date) async {
    try {
      final resp = await http.get(
        Uri.parse('$baseUrl/api/mouvements-camions?all=1&date=$date'),
        headers: _headers,
      ).timeout(const Duration(seconds: 8));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        return (data['camions'] as List).cast<Map<String, dynamic>>();
      }
    } catch (_) {}
    return [];
  }

  static Future<List<Map<String, dynamic>>> getNotifications() async {
    try {
      final resp = await http.get(Uri.parse('$baseUrl/api/notifications'), headers: _headers).timeout(const Duration(seconds: 5));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        return (data['notifications'] as List).cast<Map<String, dynamic>>();
      }
    } catch (_) {}
    return [];
  }

  static Future<Map<String, dynamic>?> getStats(String date) async {
    try {
      final resp = await http.get(
        Uri.parse('$baseUrl/api/mouvements-camions/stats?date=$date'),
        headers: _headers,
      ).timeout(const Duration(seconds: 8));
      if (resp.statusCode == 200) {
        return jsonDecode(resp.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  static Future<bool> demarrerEmplissage(int id) async {
    try {
      final resp = await http.put(
        Uri.parse('$baseUrl/api/mouvements-camions'),
        headers: _headers,
        body: jsonEncode({'id': id, 'action': 'demarrer'}),
      ).timeout(const Duration(seconds: 10));
      return resp.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> updateBouteilles(int id, Map<String, dynamic> data) async {
    try {
      final resp = await http.put(
        Uri.parse('$baseUrl/api/mouvements-camions'),
        headers: _headers,
        body: jsonEncode({...data, 'id': id, 'action': 'terrain'}),
      ).timeout(const Duration(seconds: 10));
      return resp.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> terminerChargement(int id, Map<String, dynamic> data) async {
    try {
      final resp = await http.put(
        Uri.parse('$baseUrl/api/mouvements-camions'),
        headers: _headers,
        body: jsonEncode({...data, 'id': id, 'action': 'terminer'}),
      ).timeout(const Duration(seconds: 10));
      return resp.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}

// ─── AUTH WRAPPER ─────────────────────────────────────────────────────────────
class AuthWrapper extends StatefulWidget {
  const AuthWrapper({Key? key}) : super(key: key);

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _loading = true;
  Map<String, dynamic>? _user;

  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  Future<void> _checkSession() async {
    await ApiService.loadConfig();
    if (ApiService.baseUrl.isNotEmpty && ApiService._cookie != null) {
      try {
        final resp = await http
            .get(Uri.parse('${ApiService.baseUrl}/api/auth/session'), headers: {'Cookie': ApiService._cookie!})
            .timeout(const Duration(seconds: 5));
        if (resp.statusCode == 200) {
          final data = jsonDecode(resp.body);
          if (data['user'] != null && data['user']['role'] == 'CHEF_EQUIPE') {
            setState(() {
              _user = data['user'];
              _loading = false;
            });
            return;
          }
        }
      } catch (_) {}
    }
    setState(() {
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: kPrimary)));
    }
    if (_user == null) {
      return LoginScreen(onLogin: (u) => setState(() => _user = u));
    }
    return HomeScreen(user: _user!, onLogout: () => setState(() => _user = null));
  }
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
class LoginScreen extends StatefulWidget {
  final Function(Map<String, dynamic>) onLogin;
  const LoginScreen({Key? key, required this.onLogin}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _urlCtrl = TextEditingController(text: 'http://');
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _loading = false;
  bool _remember = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _loadSaved();
  }

  Future<void> _loadSaved() async {
    final prefs = await SharedPreferences.getInstance();
    final url = prefs.getString('base_url') ?? '';
    final user = prefs.getString('session_username') ?? '';
    final pass = prefs.getString('session_password') ?? '';
    if (url.isNotEmpty && user.isNotEmpty) {
      setState(() {
        _urlCtrl.text = url;
        _userCtrl.text = user;
        _passCtrl.text = pass;
        _remember = true;
      });
    }
  }

  Future<void> _login() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    final url = _urlCtrl.text.trim().replaceAll(RegExp(r'/$'), '');
    final user = await ApiService.login(url, _userCtrl.text.trim(), _passCtrl.text.trim());
    if (user != null) {
      if (user['role'] != 'CHEF_EQUIPE') {
        setState(() {
          _error = 'Accès réservé au Chef d\'équipe';
          _loading = false;
        });
      } else {
        if (_remember) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('base_url', url);
          await prefs.setString('session_username', _userCtrl.text.trim());
          await prefs.setString('session_password', _passCtrl.text.trim());
        }
        widget.onLogin(user);
      }
    } else {
      setState(() {
        _error = 'Identifiants incorrects ou serveur inaccessible';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [kBg, kCard],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: 1),
                  duration: const Duration(milliseconds: 800),
                  builder: (ctx, val, _) => Transform.scale(
                    scale: val,
                    child: Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: kPrimary.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: kPrimary.withOpacity(0.5), width: 2),
                      ),
                      child: const Icon(Icons.local_fire_department, color: kPrimary, size: 48),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                const Text('OUARGAZ', style: TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: 3)),
                const Text('Chef d\'équipe Mobile', style: TextStyle(color: kMuted, fontSize: 14, letterSpacing: 1)),
                const SizedBox(height: 40),
                TextField(
                  controller: _urlCtrl,
                  decoration: InputDecoration(
                    labelText: 'URL serveur',
                    prefixIcon: const Icon(Icons.link, color: kMuted),
                    hintText: 'http://192.168.1.100:3000',
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _userCtrl,
                  decoration: InputDecoration(
                    labelText: 'Identifiant',
                    prefixIcon: const Icon(Icons.person, color: kMuted),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _passCtrl,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: 'Mot de passe',
                    prefixIcon: const Icon(Icons.lock, color: kMuted),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Checkbox(value: _remember, activeColor: kPrimary, onChanged: (v) => setState(() => _remember = v ?? false)),
                    const Expanded(child: Text('Se souvenir de moi', style: TextStyle(color: kMuted, fontSize: 12))),
                    IconButton(onPressed: () => ThemeController.toggle(), icon: const Icon(Icons.dark_mode, color: kMuted, size: 20)),
                  ],
                ),
                if (_error.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: kPrimary.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(_error, style: const TextStyle(color: kPrimary, fontSize: 13)),
                  ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _login,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kPrimary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 8,
                    ),
                    child: _loading
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Connexion', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, letterSpacing: 1)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
class HomeScreen extends StatefulWidget {
  final Map<String, dynamic> user;
  final VoidCallback onLogout;
  const HomeScreen({Key? key, required this.user, required this.onLogout}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  List<Map<String, dynamic>> _fileAttente = [];
  List<Map<String, dynamic>> _internes = [];
  List<Map<String, dynamic>> _prets = [];
  List<Map<String, dynamic>> _notifs = [];
  Map<String, dynamic>? _stats;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final fa = await ApiService.getCamionsFile();
    final ci = await ApiService.getCamionsInternes();
    final cp = await ApiService.getCamionsPrets();
    final n = await ApiService.getNotifications();
    final s = await ApiService.getStats(DateFormat('yyyy-MM-dd').format(DateTime.now()));
    if (mounted) {
      setState(() {
        _fileAttente = fa;
        _internes = ci;
        _prets = cp;
        _notifs = n;
        _stats = s;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final unread = _notifs.where((n) => n['read'] == false).length;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.local_fire_department, color: kPrimary, size: 22),
            const SizedBox(width: 10),
            const Expanded(child: Text('OUARGAZ', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.5))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: kPrimary.withOpacity(0.2), borderRadius: BorderRadius.circular(6)),
              child: const Text('Chef équipe', style: TextStyle(color: kPrimary, fontSize: 10, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.brightness_6_outlined), onPressed: ThemeController.toggle),
          Stack(
            children: [
              IconButton(icon: const Icon(Icons.notifications_outlined), onPressed: () => setState(() => _tab = 4)),
              if (unread > 0)
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    width: 16,
                    height: 16,
                    decoration: const BoxDecoration(color: kPrimary, shape: BoxShape.circle),
                    child: Center(child: Text('$unread', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold))),
                  ),
                ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await http.post(Uri.parse('${ApiService.baseUrl}/api/auth/logout'), headers: {'Cookie': ApiService._cookie ?? ''}).timeout(const Duration(seconds: 5)).catchError((_) => http.Response('', 200));
              final prefs = await SharedPreferences.getInstance();
              await prefs.clear();
              widget.onLogout();
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _tab,
        children: [
          _buildFileAttente(),
          _buildInternes(),
          _buildPrets(),
          _buildHistorique(),
          _buildNotifs(),
          if (_stats != null) _buildKpi(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        backgroundColor: ThemeController.isDark.value ? kCard : const Color(0xFFF3F4F6),
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: [
          const NavigationDestination(icon: Icon(Icons.schedule_outlined), label: 'File'),
          NavigationDestination(
            icon: Stack(
              children: [
                const Icon(Icons.local_shipping_outlined),
                if (_internes.isNotEmpty) Positioned(top: 0, right: 0, child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: kInfo, shape: BoxShape.circle))),
              ],
            ),
            label: 'Internes',
          ),
          NavigationDestination(
            icon: Stack(
              children: [
                const Icon(Icons.check_circle_outline),
                if (_prets.isNotEmpty) Positioned(top: 0, right: 0, child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: kSuccess, shape: BoxShape.circle))),
              ],
            ),
            label: 'Prêts',
          ),
          const NavigationDestination(icon: Icon(Icons.history), label: 'Historique'),
          NavigationDestination(
            icon: Stack(
              children: [
                const Icon(Icons.notifications_outlined),
                if (unread > 0) Positioned(top: 0, right: 0, child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: kPrimary, shape: BoxShape.circle))),
              ],
            ),
            label: 'Notifs',
          ),
          const NavigationDestination(icon: Icon(Icons.analytics_outlined), label: 'KPI'),
        ],
      ),
    );
  }

  Widget _buildFileAttente() => RefreshIndicator(
    color: kPrimary,
    onRefresh: _load,
    child: _fileAttente.isEmpty
        ? const Center(child: Text('Aucun camion en attente', style: TextStyle(color: kMuted)))
        : ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: _fileAttente.length,
            itemBuilder: (ctx, i) => _camionTile(_fileAttente[i]),
          ),
  );

  Widget _buildGroupHeader(String title, int count, Color color, IconData icon) {
    final isDark = ThemeController.isDark.value;
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 8, left: 4, right: 4),
      child: Row(
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white70 : Colors.black87,
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '$count',
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInternes() {
    if (_internes.isEmpty) {
      return RefreshIndicator(
        color: kPrimary,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 100),
            Center(child: Text('Aucun camion en traitement', style: TextStyle(color: kMuted))),
          ],
        ),
      );
    }

    final demarrage = _internes.where((c) => c['statut'] == 'DEMARRAGE_EMPLISSAGE').toList();
    final enCours = _internes.where((c) => c['statut'] == 'EN_COURS_TRAITEMENT').toList();
    final autres = _internes.where((c) => c['statut'] != 'DEMARRAGE_EMPLISSAGE' && c['statut'] != 'EN_COURS_TRAITEMENT').toList();

    final List<Widget> children = [];

    if (demarrage.isNotEmpty) {
      children.add(_buildGroupHeader('Démarrage Emplissage', demarrage.length, kWarning, Icons.play_circle_outline));
      children.addAll(demarrage.map((c) => _detailTile(c)));
    }

    if (enCours.isNotEmpty) {
      children.add(_buildGroupHeader('En cours de traitement', enCours.length, kInfo, Icons.hourglass_bottom));
      children.addAll(enCours.map((c) => _detailTile(c)));
    }

    if (autres.isNotEmpty) {
      children.add(_buildGroupHeader('Autres', autres.length, kMuted, Icons.help_outline));
      children.addAll(autres.map((c) => _detailTile(c)));
    }

    return RefreshIndicator(
      color: kPrimary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: children,
      ),
    );
  }


  Widget _buildPrets() => RefreshIndicator(
    color: kPrimary,
    onRefresh: _load,
    child: _prets.isEmpty
        ? const Center(child: Text('Aucun camion prêt', style: TextStyle(color: kMuted)))
        : ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: _prets.length,
            itemBuilder: (ctx, i) => Card(margin: const EdgeInsets.only(bottom: 10), child: ListTile(title: Text(_prets[i]['matricule'] ?? '', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text(_prets[i]['client'] ?? '', style: const TextStyle(color: kMuted, fontSize: 12)), trailing: const Icon(Icons.check_circle, color: kSuccess))),
          ),
  );

  Widget _buildHistorique() {
    final date = DateFormat('yyyy-MM-dd').format(DateTime.now());
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: ApiService.getHistorique(date),
      builder: (ctx, snap) => snap.hasData
          ? snap.data!.isEmpty
              ? const Center(child: Text('Aucun camion', style: TextStyle(color: kMuted)))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: snap.data!.length,
                  itemBuilder: (ctx, i) => Card(margin: const EdgeInsets.only(bottom: 10), child: ListTile(title: Text(snap.data![i]['matricule'] ?? ''), subtitle: Text('${snap.data![i]['client']} • ${snap.data![i]['statut']}', style: const TextStyle(color: kMuted, fontSize: 11)))),
                )
          : const Center(child: CircularProgressIndicator(color: kPrimary)),
    );
  }

  Widget _buildNotifs() => RefreshIndicator(
    color: kPrimary,
    onRefresh: _load,
    child: _notifs.isEmpty
        ? const Center(child: Text('Aucune notification', style: TextStyle(color: kMuted)))
        : ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: _notifs.length,
            itemBuilder: (ctx, i) {
              final n = _notifs[i];
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                color: (n['read'] == true) ? kCard : kPrimary.withOpacity(0.08),
                child: ListTile(
                  leading: Icon((n['read'] == true) ? Icons.notifications_outlined : Icons.notifications_active, color: (n['read'] == true) ? kMuted : kPrimary),
                  title: Text(n['title'] ?? '', style: TextStyle(fontWeight: (n['read'] == true) ? FontWeight.w600 : FontWeight.w800)),
                  subtitle: Text(n['message'] ?? '', style: const TextStyle(color: kMuted, fontSize: 12)),
                ),
              );
            },
          ),
  );

  Widget _buildKpi() {
    final day = _stats!['day'] ?? {};
    final counts = _stats!['dayCounts'] ?? {};
    return SingleChildScrollView(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Camions', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _kpiCard('Arrivés', counts['arrives'] ?? 0, kPrimary),
              _kpiCard('Internes', counts['internes'] ?? 0, kInfo),
              _kpiCard('Prêts', counts['prets'] ?? 0, kSuccess),
              _kpiCard('Sortis', counts['sortis'] ?? 0, kSuccess),
            ],
          ),
          const SizedBox(height: 20),
          const Text('Bouteilles', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _kpiCard('Entrées', day['entreesTotal'] ?? 0, kInfo),
              _kpiCard('Sorties', day['sortiesTotal'] ?? 0, kSuccess),
            ],
          ),
        ],
      ),
    );
  }

  void _showCamionDetails(Map<String, dynamic> c) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final isDark = ThemeController.isDark.value;
        final bg = isDark ? kCard : Colors.white;
        final textStyle = TextStyle(color: isDark ? Colors.white : Colors.black87);
        final subtitleStyle = const TextStyle(color: kMuted, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1);
        
        return Container(
          decoration: BoxDecoration(
            color: bg,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: isDark ? kBorder : const Color(0xFFE5E7EB)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: kMuted.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          c['matricule'] ?? 'Sans matricule',
                          style: textStyle.copyWith(fontSize: 22, fontWeight: FontWeight.w900),
                        ),
                        Text(
                          c['client'] ?? 'Sans client',
                          style: textStyle.copyWith(fontSize: 16, color: kPrimary, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: kWarning.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: kWarning.withOpacity(0.3)),
                    ),
                    child: Text(
                      c['statut'] ?? 'EN_ATTENTE',
                      style: const TextStyle(color: kWarning, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const Divider(height: 24, color: kBorder),
              Text('INFORMATIONS GÉNÉRALES', style: subtitleStyle),
              const SizedBox(height: 10),
              _infoRow(Icons.person_outline, 'Chauffeur', c['chauffeur'] ?? 'N/A', textStyle),
              _infoRow(Icons.branding_watermark_outlined, 'Marque', c['marque'] ?? 'N/A', textStyle),
              _infoRow(Icons.description_outlined, 'N° Bon de Chargement', c['numero_bc'] ?? 'N/A', textStyle),
              _infoRow(Icons.calendar_today_outlined, 'Date', c['date'] ?? 'N/A', textStyle),
              const Divider(height: 24, color: kBorder),
              Text('DÉTAILS DES BOUTEILLES (ENTRÉE)', style: subtitleStyle),
              const SizedBox(height: 12),
              _bottleSection('Bouteilles Vides', [
                c['vides_12kg'] ?? 0,
                c['vides_6kg'] ?? 0,
                c['vides_3kg'] ?? 0,
              ]),
              const SizedBox(height: 16),
              _bottleSection('Défectueuses Rendues', [
                c['def_rendues_12kg'] ?? 0,
                c['def_rendues_6kg'] ?? 0,
                c['def_rendues_3kg'] ?? 0,
              ]),
              const SizedBox(height: 16),
            ],
          ),
        );
      },
    );
  }

  Widget _infoRow(IconData icon, String label, String value, TextStyle textStyle) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: kMuted),
          const SizedBox(width: 8),
          Text('$label: ', style: textStyle.copyWith(color: kMuted, fontWeight: FontWeight.w600)),
          Expanded(child: Text(value, style: textStyle.copyWith(fontWeight: FontWeight.w800), textAlign: TextAlign.right)),
        ],
      ),
    );
  }

  Widget _bottleSection(String title, List<dynamic> values) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(color: kPrimary, fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _bottleCount('12 kg', values[0]),
            _bottleCount('6 kg', values[1]),
            _bottleCount('3 kg', values[2]),
          ],
        ),
      ],
    );
  }

  Widget _bottleCount(String label, dynamic count) {
    final isDark = ThemeController.isDark.value;
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isDark ? kCard : const Color(0xFFF3F4F6),
            shape: BoxShape.circle,
          ),
          child: Text('$count', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: isDark ? Colors.white : Colors.black87)),
        ),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 10, color: kMuted, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _camionTile(Map<String, dynamic> c) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    child: InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => _showCamionDetails(c),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c['matricule'] ?? '', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                      Text(c['client'] ?? '', style: const TextStyle(color: kMuted, fontSize: 12)),
                    ],
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(c['chauffeur'] ?? '', style: const TextStyle(color: kMuted, fontSize: 11)),
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_right, color: kMuted, size: 20),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _badge('12 kg (Vides)', '${c['vides_12kg'] ?? 0}', k12kg),
                _badge('6 kg (Vides)', '${c['vides_6kg'] ?? 0}', k6kg),
                _badge('3 kg (Vides)', '${c['vides_3kg'] ?? 0}', k3kg),
              ],
            ),
          ],
        ),
      ),
    ),
  );

  Color _getStatusColor(String? status) {
    if (status == null) return kMuted;
    if (status == 'EN_ATTENTE') return kWarning;
    if (status == 'PRET_A_SORTIR') return kSuccess;
    if (status == 'DEMARRAGE_EMPLISSAGE') return kWarning;
    if (status == 'EN_COURS_TRAITEMENT') return kInfo;
    return kPrimary;
  }

  Widget _buildRecapTile(String label, int value, bool isDark, {Color? color}) {
    final displayColor = color ?? (isDark ? Colors.white60 : Colors.black54);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E2A3A) : const Color(0xFFF5F5F5),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: isDark ? kBorder : const Color(0xFFE5E7EB)),
      ),
      child: Column(
        children: [
          Text(label, style: const TextStyle(color: kMuted, fontSize: 10, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(
            '$value',
            style: TextStyle(
              color: displayColor,
              fontSize: 13,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  void _showEditBouteillesForm(Map<String, dynamic> c) {
    final bool isDemarrage = c['statut'] == 'DEMARRAGE_EMPLISSAGE';

    // Controllers for EN_COURS_TRAITEMENT
    final v12 = TextEditingController(text: '${c['terrain_vides_12kg'] ?? c['vides_12kg'] ?? 0}');
    final v6 = TextEditingController(text: '${c['terrain_vides_6kg'] ?? c['vides_6kg'] ?? 0}');
    final v3 = TextEditingController(text: '${c['terrain_vides_3kg'] ?? c['vides_3kg'] ?? 0}');
    final d12 = TextEditingController(text: '${c['def_rendues_12kg'] ?? 0}');
    final d6 = TextEditingController(text: '${c['def_rendues_6kg'] ?? 0}');
    final d3 = TextEditingController(text: '${c['def_rendues_3kg'] ?? 0}');

    // Controllers for DEMARRAGE_EMPLISSAGE
    final tr12 = c['def_traitees_12kg'] ?? c['def_rendues_12kg'] ?? 0;
    final tr6 = c['def_traitees_6kg'] ?? c['def_rendues_6kg'] ?? 0;
    final tr3 = c['def_traitees_3kg'] ?? c['def_rendues_3kg'] ?? 0;

    final p12 = TextEditingController(text: '${c['charge_12kg'] != 0 ? c['charge_12kg'] : tr12}');
    final p6 = TextEditingController(text: '${c['charge_6kg'] != 0 ? c['charge_6kg'] : tr6}');
    final p3 = TextEditingController(text: '${c['charge_3kg'] != 0 ? c['charge_3kg'] : tr3}');

    final acc12 = TextEditingController(text: '${c['def_acceptees_12kg'] != 0 ? c['def_acceptees_12kg'] : tr12}');
    final acc6 = TextEditingController(text: '${c['def_acceptees_6kg'] != 0 ? c['def_acceptees_6kg'] : tr6}');
    final acc3 = TextEditingController(text: '${c['def_acceptees_3kg'] != 0 ? c['def_acceptees_3kg'] : tr3}');

    final etr12 = TextEditingController(text: '${c['terrain_etr_12kg'] ?? c['etrangeres_12kg'] ?? 0}');
    final etr6 = TextEditingController(text: '${c['terrain_etr_6kg'] ?? c['etrangeres_6kg'] ?? 0}');
    final etr3 = TextEditingController(text: '${c['terrain_etr_3kg'] ?? c['etrangeres_3kg'] ?? 0}');

    bool isSaveDisabled = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final isDark = ThemeController.isDark.value;
        final bg = isDark ? kCard : Colors.white;
        final textStyle = TextStyle(color: isDark ? Colors.white : Colors.black87);
        final titleStyle = const TextStyle(fontSize: 16, fontWeight: FontWeight.bold);

        return StatefulBuilder(
          builder: (ctx, setModalState) {
            // Live calculations for Refusées
            final acc12Val = int.tryParse(acc12.text) ?? 0;
            final acc6Val = int.tryParse(acc6.text) ?? 0;
            final acc3Val = int.tryParse(acc3.text) ?? 0;

            final ref12 = (tr12 - acc12Val).clamp(0, 99999);
            final ref6 = (tr6 - acc6Val).clamp(0, 99999);
            final ref3 = (tr3 - acc3Val).clamp(0, 99999);

            return Padding(
              padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
              child: Container(
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                  border: Border.all(color: isDark ? kBorder : const Color(0xFFE5E7EB)),
                ),
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 40, height: 4,
                          decoration: BoxDecoration(color: kMuted.withOpacity(0.3), borderRadius: BorderRadius.circular(2)),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        isDemarrage ? 'Fin chargement' : 'Correction quantités terrain (Chef d\'équipe)',
                        style: titleStyle.copyWith(color: isDark ? Colors.white : Colors.black),
                      ),
                      if (isDemarrage) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Sortie prévue : pleines + défectueuses refusées + étrangères',
                          style: TextStyle(color: kMuted, fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ],
                      const SizedBox(height: 16),

                      if (!isDemarrage) ...[
                        // EN_COURS_TRAITEMENT Form
                        Text('Bouteilles Vides', style: textStyle.copyWith(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(child: _buildNumberField(v12, '12 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false))),
                            const SizedBox(width: 8),
                            Expanded(child: _buildNumberField(v6, '6 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false))),
                            const SizedBox(width: 8),
                            Expanded(child: _buildNumberField(v3, '3 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false))),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text('Défectueuses Rendues', style: textStyle.copyWith(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(child: _buildNumberField(d12, '12 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false))),
                            const SizedBox(width: 8),
                            Expanded(child: _buildNumberField(d6, '6 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false))),
                            const SizedBox(width: 8),
                            Expanded(child: _buildNumberField(d3, '3 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false))),
                          ],
                        ),
                      ] else ...[
                        // DEMARRAGE_EMPLISSAGE Form

                        // Group 1: Traitées (Reçues) & Pleines chargées
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1E2A3A).withOpacity(0.4) : const Color(0xFFFAFAFA),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: isDark ? kBorder : const Color(0xFFE5E7EB)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Traitées & Pleines chargées', style: titleStyle.copyWith(fontSize: 13, color: kPrimary)),
                              const SizedBox(height: 12),
                              Text('Traitées (Reçues)', style: textStyle.copyWith(fontSize: 11, color: kMuted, fontWeight: FontWeight.w600)),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  Expanded(child: _buildRecapTile('12 kg', tr12, isDark)),
                                  const SizedBox(width: 8),
                                  Expanded(child: _buildRecapTile('6 kg', tr6, isDark)),
                                  const SizedBox(width: 8),
                                  Expanded(child: _buildRecapTile('3 kg', tr3, isDark)),
                                ],
                              ),
                              const SizedBox(height: 14),
                              Text('Pleines chargées', style: textStyle.copyWith(fontSize: 11, color: kMuted, fontWeight: FontWeight.w600)),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(child: _buildNumberField(p12, '12 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false), maxValue: tr12)),
                                  const SizedBox(width: 8),
                                  Expanded(child: _buildNumberField(p6, '6 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false), maxValue: tr6)),
                                  const SizedBox(width: 8),
                                  Expanded(child: _buildNumberField(p3, '3 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false), maxValue: tr3)),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Group 2: Acceptées (Remplacées) & Refusées (Calculé)
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1E2A3A).withOpacity(0.4) : const Color(0xFFFAFAFA),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: isDark ? kBorder : const Color(0xFFE5E7EB)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Acceptées & Refusées', style: titleStyle.copyWith(fontSize: 13, color: kSuccess)),
                              const SizedBox(height: 12),
                              Text('Acceptées (Remplacées)', style: textStyle.copyWith(fontSize: 11, color: kMuted, fontWeight: FontWeight.w600)),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(child: _buildNumberField(acc12, '12 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false), maxValue: tr12)),
                                  const SizedBox(width: 8),
                                  Expanded(child: _buildNumberField(acc6, '6 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false), maxValue: tr6)),
                                  const SizedBox(width: 8),
                                  Expanded(child: _buildNumberField(acc3, '3 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false), maxValue: tr3)),
                                ],
                              ),
                              const SizedBox(height: 14),
                              Text('Refusées (Calculé)', style: textStyle.copyWith(fontSize: 11, color: kMuted, fontWeight: FontWeight.w600)),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  Expanded(child: _buildRecapTile('12 kg', ref12, isDark, color: kPrimary)),
                                  const SizedBox(width: 8),
                                  Expanded(child: _buildRecapTile('6 kg', ref6, isDark, color: kPrimary)),
                                  const SizedBox(width: 8),
                                  Expanded(child: _buildRecapTile('3 kg', ref3, isDark, color: kPrimary)),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Group 3: Étrangères
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1E2A3A).withOpacity(0.4) : const Color(0xFFFAFAFA),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: isDark ? kBorder : const Color(0xFFE5E7EB)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Étrangères détectées pendant emplissage', style: titleStyle.copyWith(fontSize: 13, color: kInfo)),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(child: _buildNumberField(etr12, '12 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false))),
                                  const SizedBox(width: 8),
                                  Expanded(child: _buildNumberField(etr6, '6 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false))),
                                  const SizedBox(width: 8),
                                  Expanded(child: _buildNumberField(etr3, '3 kg', isDark, onChanged: () => setModalState(() => isSaveDisabled = false))),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],

                      const SizedBox(height: 24),

                      // Action Buttons
                      if (!isDemarrage) ...[
                        Row(
                          children: [
                            Expanded(
                              child: SizedBox(
                                height: 48,
                                child: OutlinedButton.icon(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: isDark ? Colors.white : kPrimary,
                                    side: BorderSide(
                                      color: isSaveDisabled
                                          ? (isDark ? Colors.white10 : Colors.grey.shade300)
                                          : (isDark ? Colors.white30 : kPrimary.withOpacity(0.5)),
                                      width: 1.5,
                                    ),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                  onPressed: isSaveDisabled
                                      ? null
                                      : () async {
                                          setModalState(() {
                                            isSaveDisabled = true;
                                          });
                                          final data = {
                                            'terrain_vides_12kg': int.tryParse(v12.text) ?? 0,
                                            'terrain_vides_6kg': int.tryParse(v6.text) ?? 0,
                                            'terrain_vides_3kg': int.tryParse(v3.text) ?? 0,
                                            'vides_12kg': int.tryParse(v12.text) ?? 0,
                                            'vides_6kg': int.tryParse(v6.text) ?? 0,
                                            'vides_3kg': int.tryParse(v3.text) ?? 0,
                                            'def_rendues_12kg': int.tryParse(d12.text) ?? 0,
                                            'def_rendues_6kg': int.tryParse(d6.text) ?? 0,
                                            'def_rendues_3kg': int.tryParse(d3.text) ?? 0,
                                          };
                                          final success = await ApiService.updateBouteilles(c['id'], data);
                                          if (success) {
                                            if (mounted) {
                                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                                                  content: Text('Données sauvegardées', style: TextStyle(color: Colors.white)),
                                                  backgroundColor: kSuccess));
                                              _load();
                                            }
                                            setModalState(() {
                                              isSaveDisabled = true;
                                            });
                                          } else {
                                            if (mounted) {
                                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                                  content: const Text('Erreur de sauvegarde', style: TextStyle(color: Colors.white)),
                                                  backgroundColor: Colors.red));
                                            }
                                            setModalState(() {
                                              isSaveDisabled = false;
                                            });
                                          }
                                        },
                                  icon: const Icon(Icons.save_rounded, size: 18),
                                  label: const Text('Sauvegarder', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: SizedBox(
                                height: 48,
                                child: ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: kSuccess,
                                    foregroundColor: Colors.white,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    elevation: 0,
                                  ),
                                  onPressed: () async {
                                    Navigator.pop(ctx);
                                    final success = await ApiService.demarrerEmplissage(c['id']);
                                    if (success) {
                                      if (mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                                            content: Text('Statut mis à jour', style: TextStyle(color: Colors.white)),
                                            backgroundColor: kSuccess));
                                        _load();
                                      }
                                    } else {
                                      if (mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                            content: const Text('Erreur', style: TextStyle(color: Colors.white)),
                                            backgroundColor: Colors.red));
                                      }
                                    }
                                  },
                                  icon: const Icon(Icons.play_arrow_rounded, size: 20),
                                  label: const Text('Démarrer', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ] else ...[
                        Row(
                          children: [
                            Expanded(
                              child: SizedBox(
                                height: 48,
                                child: OutlinedButton.icon(
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: isDark ? Colors.white : kPrimary,
                                    side: BorderSide(
                                      color: isSaveDisabled
                                          ? (isDark ? Colors.white10 : Colors.grey.shade300)
                                          : (isDark ? Colors.white30 : kPrimary.withOpacity(0.5)),
                                      width: 1.5,
                                    ),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                  onPressed: isSaveDisabled
                                      ? null
                                      : () async {
                                          setModalState(() {
                                            isSaveDisabled = true;
                                          });
                                          final data = {
                                            'terrain_etr_12kg': int.tryParse(etr12.text) ?? 0,
                                            'terrain_etr_6kg': int.tryParse(etr6.text) ?? 0,
                                            'terrain_etr_3kg': int.tryParse(etr3.text) ?? 0,
                                            'charge_12kg': int.tryParse(p12.text) ?? 0,
                                            'charge_6kg': int.tryParse(p6.text) ?? 0,
                                            'charge_3kg': int.tryParse(p3.text) ?? 0,
                                            'def_acceptees_12kg': int.tryParse(acc12.text) ?? 0,
                                            'def_acceptees_6kg': int.tryParse(acc6.text) ?? 0,
                                            'def_acceptees_3kg': int.tryParse(acc3.text) ?? 0,
                                          };
                                          final success = await ApiService.updateBouteilles(c['id'], data);
                                          if (success) {
                                            if (mounted) {
                                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                                                  content: Text('Données sauvegardées temporairement', style: TextStyle(color: Colors.white)),
                                                  backgroundColor: kSuccess));
                                              _load();
                                            }
                                            setModalState(() {
                                              isSaveDisabled = true;
                                            });
                                          } else {
                                            if (mounted) {
                                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                                  content: const Text('Erreur de sauvegarde', style: TextStyle(color: Colors.white)),
                                                  backgroundColor: Colors.red));
                                            }
                                            setModalState(() {
                                              isSaveDisabled = false;
                                            });
                                          }
                                        },
                                  icon: const Icon(Icons.save_rounded, size: 18),
                                  label: const Text('Sauvegarder', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: SizedBox(
                                height: 48,
                                child: ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: kSuccess,
                                    foregroundColor: Colors.white,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    elevation: 0,
                                  ),
                                  onPressed: () async {
                                    Navigator.pop(ctx);
                                    final data = {
                                      'charge_12kg': int.tryParse(p12.text) ?? 0,
                                      'charge_6kg': int.tryParse(p6.text) ?? 0,
                                      'charge_3kg': int.tryParse(p3.text) ?? 0,
                                      'def_acceptees_12kg': int.tryParse(acc12.text) ?? 0,
                                      'def_acceptees_6kg': int.tryParse(acc6.text) ?? 0,
                                      'def_acceptees_3kg': int.tryParse(acc3.text) ?? 0,
                                      'terrain_etr_12kg': int.tryParse(etr12.text) ?? 0,
                                      'terrain_etr_6kg': int.tryParse(etr6.text) ?? 0,
                                      'terrain_etr_3kg': int.tryParse(etr3.text) ?? 0,
                                    };
                                    final success = await ApiService.terminerChargement(c['id'], data);
                                    if (success) {
                                      if (mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                                            content: Text('Chargement terminé', style: TextStyle(color: Colors.white)),
                                            backgroundColor: kSuccess));
                                        _load();
                                      }
                                    } else {
                                      if (mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                            content: const Text('Erreur', style: TextStyle(color: Colors.white)),
                                            backgroundColor: Colors.red));
                                      }
                                    }
                                  },
                                  icon: const Icon(Icons.check_circle_rounded, size: 20),
                                  label: const Text('Terminer', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildNumberField(TextEditingController controller, String label, bool isDark, {VoidCallback? onChanged, int? maxValue}) {
    void increment() {
      int val = int.tryParse(controller.text) ?? 0;
      if (maxValue == null || val < maxValue) {
        controller.text = '${val + 1}';
        if (onChanged != null) onChanged();
      }
    }
    void decrement() {
      int val = int.tryParse(controller.text) ?? 0;
      if (val > 0) {
        controller.text = '${val - 1}';
        if (onChanged != null) onChanged();
      }
    }

    final textStyle = TextStyle(
      color: isDark ? Colors.white : Colors.black87,
      fontSize: 13,
      fontWeight: FontWeight.bold,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(label, style: const TextStyle(color: kMuted, fontSize: 10, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Container(
          height: 38,
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E2A3A) : const Color(0xFFF5F5F5),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: isDark ? kBorder : const Color(0xFFE5E7EB)),
          ),
          child: Row(
            children: [
              GestureDetector(
                onTap: decrement,
                behavior: HitTestBehavior.opaque,
                child: SizedBox(
                  width: 28,
                  height: 38,
                  child: Icon(Icons.remove, size: 14, color: kPrimary),
                ),
              ),
              Expanded(
                child: TextField(
                  controller: controller,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  style: textStyle,
                  onChanged: (val) {
                    int parsed = int.tryParse(val) ?? 0;
                    if (maxValue != null && parsed > maxValue) {
                      controller.text = '$maxValue';
                      controller.selection = TextSelection.fromPosition(TextPosition(offset: controller.text.length));
                    }
                    if (onChanged != null) onChanged();
                  },
                  decoration: const InputDecoration(
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(vertical: 4),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                  ),
                  onTap: () {
                    controller.selection = TextSelection(
                      baseOffset: 0,
                      extentOffset: controller.text.length,
                    );
                  },
                ),
              ),
              GestureDetector(
                onTap: increment,
                behavior: HitTestBehavior.opaque,
                child: SizedBox(
                  width: 28,
                  height: 38,
                  child: Icon(Icons.add, size: 14, color: kSuccess),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _detailTile(Map<String, dynamic> c) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
      side: BorderSide(color: _getStatusColor(c['statut']).withOpacity(0.5), width: 1),
    ),
    child: ListTile(
      onTap: () => _showEditBouteillesForm(c),
      title: Text(c['matricule'] ?? '', style: const TextStyle(fontWeight: FontWeight.w800)),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 4),
          Text(c['client'] ?? '', style: const TextStyle(color: kMuted, fontSize: 12)),
          Text('Marque: ${c['marque'] ?? ''}', style: const TextStyle(color: kMuted, fontSize: 12)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: _getStatusColor(c['statut']).withOpacity(0.15),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: _getStatusColor(c['statut']).withOpacity(0.3)),
            ),
            child: Text(
              c['statut'] ?? 'Inconnu',
              style: TextStyle(
                color: _getStatusColor(c['statut']),
                fontSize: 11,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
      trailing: const Icon(Icons.chevron_right, color: kMuted),
    ),
  );

  Widget _badge(String label, String value, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(8), border: Border.all(color: color.withOpacity(0.3))),
    child: Column(children: [Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700)), Text(value, style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.w800))]),
  );

  Widget _kpiCard(String label, dynamic value, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(12), border: Border.all(color: color.withOpacity(0.3))),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)), const SizedBox(height: 4), Text('$value', style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w800))],
    ),
  );
}
