package app.morrow.finance;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** PAT ciphertext is separate from the ledger; its key never leaves Android Keystore. */
@CapacitorPlugin(name = "BackupCredentials")
public class BackupCredentialsPlugin extends Plugin {
    private static final String ALIAS = "morrow.github.token.v1";
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    @PluginMethod public void save(PluginCall call) {
        String token = call.getString("token", "").trim();
        if (token.isEmpty()) { call.reject("Enter a GitHub access token."); return; }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
            String encrypted = Base64.encodeToString(cipher.doFinal(token.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            boolean saved = getContext().getSharedPreferences("morrow.backup.credentials", 0).edit()
                .putString("token", encrypted).putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).commit();
            if (!saved) throw new Exception("Not saved");
            call.resolve();
        } catch (Exception error) { call.reject("Could not save the token securely on this device."); }
    }
    @PluginMethod public void load(PluginCall call) {
        try {
            android.content.SharedPreferences prefs = getContext().getSharedPreferences("morrow.backup.credentials", 0);
            String encrypted = prefs.getString("token", ""), iv = prefs.getString("iv", "");
            if (encrypted.isEmpty() || iv.isEmpty()) { call.resolve(new JSObject().put("token", "")); return; }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
            call.resolve(new JSObject().put("token", new String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), StandardCharsets.UTF_8)));
        } catch (Exception error) {
            // Restored ciphertext cannot be opened on another phone. Ask for a token again.
            getContext().getSharedPreferences("morrow.backup.credentials", 0).edit().clear().apply();
            call.resolve(new JSObject().put("token", ""));
        }
    }
    @PluginMethod public void clear(PluginCall call) {
        getContext().getSharedPreferences("morrow.backup.credentials", 0).edit().clear().apply(); call.resolve();
    }
}
