import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Trash2, AlertTriangle, Mail } from 'lucide-react-native';
import { SUPPORT_EMAIL } from '@/constants/app-config';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { isAuthenticated, deleteAccount, isDeletingAccount } = useApp();
  const [email, setEmail] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [step] = useState<'info' | 'confirm'>(isAuthenticated ? 'confirm' : 'info');

  const handleRequestDeletion = () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Erreur', 'Veuillez entrer une adresse email valide.');
      return;
    }
    Alert.alert(
      'Demande envoyée',
      `Si un compte est associé à ${email}, il sera supprimé dans un délai de 30 jours. Vous recevrez un email de confirmation.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  const handleDeleteAuthenticated = () => {
    if (confirmText !== 'SUPPRIMER') {
      Alert.alert('Erreur', 'Veuillez taper SUPPRIMER pour confirmer.');
      return;
    }
    Alert.alert(
      'Suppression définitive',
      'Cette action est irréversible. Toutes vos données seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer mon compte',
          style: 'destructive',
          onPress: () => deleteAccount(),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: 'Suppression de compte',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <ArrowLeft size={22} color={Colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.warningBanner}>
        <AlertTriangle size={28} color={Colors.error} />
        <Text style={styles.warningTitle}>Suppression de compte</Text>
        <Text style={styles.warningText}>
          La suppression de votre compte est définitive et irréversible.
        </Text>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Données supprimées :</Text>
        <View style={styles.infoItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.infoText}>Votre profil et informations personnelles</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.infoText}>Toutes vos blagues créées</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.infoText}>Vos abonnements et historique de tips</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.infoText}>Vos réactions et favoris</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.infoText}>Votre historique d'écoute</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Délai de traitement :</Text>
        <Text style={styles.infoText}>
          Votre compte sera supprimé dans un délai maximum de 30 jours après confirmation. Durant cette période, vous pouvez contacter le support pour annuler la demande.
        </Text>
      </View>

      {isAuthenticated && step === 'confirm' ? (
        <View style={styles.formSection}>
          <Text style={styles.formLabel}>
            Tapez <Text style={styles.bold}>SUPPRIMER</Text> pour confirmer :
          </Text>
          <TextInput
            style={styles.input}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="SUPPRIMER"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[
              styles.deleteBtn,
              confirmText !== 'SUPPRIMER' && styles.deleteBtnDisabled,
            ]}
            onPress={handleDeleteAuthenticated}
            disabled={confirmText !== 'SUPPRIMER' || isDeletingAccount}
          >
            {isDeletingAccount ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Trash2 size={18} color={Colors.white} />
                <Text style={styles.deleteBtnText}>Supprimer mon compte</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.formSection}>
          <Text style={styles.formLabel}>
            Entrez l'email associé à votre compte :
          </Text>
          <View style={styles.inputRow}>
            <Mail size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.inputWithIcon}
              value={email}
              onChangeText={setEmail}
              placeholder="votre@email.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity
            style={[styles.deleteBtn, !email.trim() && styles.deleteBtnDisabled]}
            onPress={handleRequestDeletion}
            disabled={!email.trim()}
          >
            <Trash2 size={18} color={Colors.white} />
            <Text style={styles.deleteBtnText}>Demander la suppression</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.contactSection}>
        <Text style={styles.contactTitle}>Besoin d'aide ?</Text>
        <Text style={styles.contactText}>
          Contactez-nous à {SUPPORT_EMAIL} pour toute question concernant la suppression de votre compte.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 60,
  },
  headerBtn: {
    padding: 4,
  },
  warningBanner: {
    alignItems: 'center',
    backgroundColor: Colors.error + '10',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 24,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.error + '30',
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.error,
    marginTop: 12,
  },
  warningText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  infoSection: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  bullet: {
    fontSize: 14,
    color: Colors.error,
    fontWeight: '700' as const,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    flex: 1,
  },
  formSection: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  formLabel: {
    fontSize: 15,
    color: Colors.text,
    marginBottom: 12,
    fontWeight: '600' as const,
  },
  bold: {
    fontWeight: '800' as const,
    color: Colors.error,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    marginBottom: 16,
    gap: 10,
  },
  inputWithIcon: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error,
    padding: 16,
    borderRadius: 14,
    gap: 8,
  },
  deleteBtnDisabled: {
    opacity: 0.5,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  contactSection: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
