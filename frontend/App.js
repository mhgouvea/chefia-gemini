import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Web/iOS: localhost | Emulador Android: 10.0.2.2 | Celular físico: IP do seu PC (ex.: http://192.168.0.10:3001)
const API = Platform.OS === 'android' ? 'http://10.0.2.2:3001/api' : 'http://localhost:3001/api';
const RESTRICTIONS = ['vegetariano', 'vegano', 'sem glúten', 'sem lactose', 'low carb'];

export default function App() {
  const [text, setText] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [restrictions, setRestrictions] = useState([]);
  const [servings, setServings] = useState(2);
  const [maxCalories, setMaxCalories] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [recipe, setRecipe] = useState(null);
  const [history, setHistory] = useState([]);

  const loadHistory = () => fetch(`${API}/recipes`).then((r) => r.json()).then(setHistory).catch(() => {});
  useEffect(() => { loadHistory(); }, []);

  const addIngredient = () => {
    const v = text.trim().toLowerCase();
    if (v && !ingredients.includes(v)) setIngredients([...ingredients, v]);
    setText('');
  };
  const toggle = (r) => setRestrictions(restrictions.includes(r) ? restrictions.filter((x) => x !== r) : [...restrictions, r]);

  async function generate() {
    setErrors([]); setRecipe(null); setLoading(true);
    try {
      const res = await fetch(`${API}/recipes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients, restrictions, servings, maxCalories: maxCalories ? Number(maxCalories) : undefined }),
      });
      const data = await res.json();
      if (!res.ok) setErrors([data.error, ...(data.details || [])]);
      else { setRecipe(data.recipe); loadHistory(); }
    } catch { setErrors(['Não foi possível conectar ao servidor. A API está rodando?']); }
    setLoading(false);
  }

  async function remove(id) {
    await fetch(`${API}/recipes/${id}`, { method: 'DELETE' });
    loadHistory();
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={s.container}>
      <StatusBar style="dark" />
      <Text style={s.title}>🍳 ChefIA</Text>
      <Text style={s.subtitle}>Diga o que tem na geladeira e o Gemini cria a receita.</Text>

      <View style={s.card}>
        <Text style={s.label}>Ingredientes</Text>
        <View style={s.row}>
          <TextInput style={[s.input, { flex: 1 }]} value={text} onChangeText={setText} placeholder="ex.: tomate"
            onSubmitEditing={addIngredient} returnKeyType="done" />
          <TouchableOpacity style={s.btnSmall} onPress={addIngredient}><Text style={s.btnText}>+</Text></TouchableOpacity>
        </View>
        <View style={s.chips}>
          {ingredients.map((i) => (
            <TouchableOpacity key={i} style={s.chipOn} onPress={() => setIngredients(ingredients.filter((x) => x !== i))}>
              <Text style={s.chipOnText}>{i}  ✕</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Restrições</Text>
        <View style={s.chips}>
          {RESTRICTIONS.map((r) => (
            <TouchableOpacity key={r} style={restrictions.includes(r) ? s.chipOn : s.chip} onPress={() => toggle(r)}>
              <Text style={restrictions.includes(r) ? s.chipOnText : s.chipText}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Porções</Text>
            <View style={s.row}>
              <TouchableOpacity style={s.btnSmall} onPress={() => setServings(Math.max(1, servings - 1))}><Text style={s.btnText}>−</Text></TouchableOpacity>
              <Text style={s.servings}>{servings}</Text>
              <TouchableOpacity style={s.btnSmall} onPress={() => setServings(Math.min(10, servings + 1))}><Text style={s.btnText}>+</Text></TouchableOpacity>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Máx. kcal/porção</Text>
            <TextInput style={s.input} value={maxCalories} onChangeText={setMaxCalories} keyboardType="numeric" placeholder="opcional" />
          </View>
        </View>

        <TouchableOpacity style={[s.btn, (loading || ingredients.length < 2) && { opacity: 0.5 }]}
          disabled={loading || ingredients.length < 2} onPress={generate}>
          <Text style={s.btnText}>{loading ? 'Gerando...' : 'Gerar receita'}</Text>
        </TouchableOpacity>
        {ingredients.length < 2 && <Text style={s.hint}>Adicione pelo menos 2 ingredientes.</Text>}
      </View>

      {loading && <ActivityIndicator size="large" color="#e8590c" style={{ marginVertical: 16 }} />}
      {errors.length > 0 && (
        <View style={s.error}>{errors.map((e, i) => <Text key={i} style={s.errorText}>• {e}</Text>)}</View>
      )}
      {recipe && <RecipeCard recipe={recipe} />}

      {history.length > 0 && <Text style={s.section}>Histórico</Text>}
      {history.map((h) => (
        <View key={h.id} style={[s.card, s.row, { justifyContent: 'space-between' }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setRecipe(h.recipe)}>
            <Text style={s.histTitle}>{h.recipe.title}</Text>
            <Text style={s.hint}>{h.input.ingredients.join(', ')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => remove(h.id)}><Text style={{ fontSize: 20 }}>🗑️</Text></TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function RecipeCard({ recipe: r }) {
  return (
    <View style={s.card}>
      <Text style={s.recipeTitle}>{r.title}</Text>
      <Text style={s.hint}>{r.description}</Text>
      <Text style={s.meta}>⏱ {r.prepTimeMinutes ?? '?'} min   🔥 {r.caloriesPerServing ?? '?'} kcal/porção   📶 {r.difficulty}</Text>
      {r.warning && <Text style={s.warning}>⚠️ {r.warning}</Text>}
      <Text style={s.label}>Ingredientes</Text>
      {r.ingredients.map((i, k) => <Text key={k} style={s.line}>• {i.quantity} {i.name}</Text>)}
      <Text style={s.label}>Modo de preparo</Text>
      {r.steps.map((st, k) => <Text key={k} style={s.line}>{k + 1}. {st}</Text>)}
      {!!r.tips && <Text style={[s.hint, { marginTop: 8 }]}>💡 {r.tips}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff8f0' },
  container: { padding: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: '#e8590c', marginTop: 24 },
  subtitle: { color: '#555', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#f1dfcf' },
  label: { fontWeight: '700', marginTop: 12, marginBottom: 6, color: '#333' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { color: '#444' },
  chipOn: { backgroundColor: '#e8590c', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipOnText: { color: '#fff', fontWeight: '600' },
  btn: { backgroundColor: '#e8590c', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  btnSmall: { backgroundColor: '#e8590c', borderRadius: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  servings: { fontSize: 18, fontWeight: '700', width: 30, textAlign: 'center' },
  hint: { color: '#777', fontSize: 13, marginTop: 4 },
  error: { backgroundColor: '#ffe3e3', borderRadius: 10, padding: 12, marginBottom: 14 },
  errorText: { color: '#c92a2a' },
  warning: { backgroundColor: '#fff3bf', padding: 8, borderRadius: 8, marginTop: 8 },
  recipeTitle: { fontSize: 22, fontWeight: '800', color: '#222' },
  meta: { marginTop: 8, color: '#444' },
  line: { marginBottom: 4, lineHeight: 20 },
  section: { fontSize: 20, fontWeight: '800', marginVertical: 10, color: '#333' },
  histTitle: { fontWeight: '700' },
});
