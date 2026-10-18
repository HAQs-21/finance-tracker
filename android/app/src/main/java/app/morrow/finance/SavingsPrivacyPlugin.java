package app.morrow.finance;

import android.os.Build;
import android.view.WindowManager;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SavingsPrivacy")
public class SavingsPrivacyPlugin extends Plugin {
    private PluginCall pending;

    private int authenticators() {
        return Build.VERSION.SDK_INT >= 30
            ? BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL
            : BiometricManager.Authenticators.BIOMETRIC_WEAK;
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", BiometricManager.from(getContext()).canAuthenticate(authenticators()) == BiometricManager.BIOMETRIC_SUCCESS);
        call.resolve(result);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (pending != null) { call.reject("Authentication is already open.", "AUTH_BUSY"); return; }
            if (BiometricManager.from(getContext()).canAuthenticate(authenticators()) != BiometricManager.BIOMETRIC_SUCCESS) {
                call.reject("Set up your Android fingerprint or screen lock first.", "AUTH_UNAVAILABLE");
                return;
            }
            pending = call;
            BiometricPrompt prompt = new BiometricPrompt((FragmentActivity) getActivity(), ContextCompat.getMainExecutor(getContext()), new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    PluginCall current = pending;
                    pending = null;
                    if (current != null) current.resolve(new JSObject().put("authenticated", true));
                }
                @Override public void onAuthenticationError(int code, CharSequence message) {
                    PluginCall current = pending;
                    pending = null;
                    if (current != null) current.reject(message.toString(), code == BiometricPrompt.ERROR_USER_CANCELED || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON || code == BiometricPrompt.ERROR_CANCELED ? "AUTH_CANCELLED" : "AUTH_FAILED");
                }
            });
            BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Unlock Savings")
                .setAllowedAuthenticators(authenticators())
                .setConfirmationRequired(false);
            if (Build.VERSION.SDK_INT < 30) info.setNegativeButtonText("Cancel");
            prompt.authenticate(info.build());
        });
    }

    @PluginMethod
    public void setPrivateScreen(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> {
            if (enabled) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }
}
