package app.morrow.finance;

import android.os.Bundle;
import androidx.appcompat.app.AppCompatDelegate;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Keep native dialogs, the launch window, and the WebView in the same
        // dark appearance as Morrow, independently of the device's day theme.
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES);
        registerPlugin(SavingsPrivacyPlugin.class);
        registerPlugin(BackupCredentialsPlugin.class);
        registerPlugin(MorrowClipboardPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
