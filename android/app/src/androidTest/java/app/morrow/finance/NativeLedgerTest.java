package app.morrow.finance;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

import android.content.Context;
import android.os.Build;
import android.os.SystemClock;
import android.view.KeyEvent;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real WebView -> Capacitor -> SQLite coverage. Run only on a disposable emulator. */
@RunWith(AndroidJUnit4.class)
public class NativeLedgerTest {
    private ActivityScenario<MainActivity> scenario;
    private final Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();

    private String evaluate(String expression) throws Exception {
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(expression, value -> {
            result.set(value);
            completed.countDown();
        }));
        assertTrue("WebView did not respond", completed.await(10, TimeUnit.SECONDS));
        return result.get();
    }

    private void run(String script) throws Exception {
        String result = evaluate("(()=>{try{" + script + ";return 'ok'}catch(e){return 'ERROR:'+e.stack}})()");
        assertFalse(result, result.contains("ERROR:"));
    }

    private void waitFor(String condition) throws Exception {
        long deadline = SystemClock.uptimeMillis() + 20000;
        while (SystemClock.uptimeMillis() < deadline) {
            if ("true".equals(evaluate("Boolean(" + condition + ")"))) return;
            SystemClock.sleep(100);
        }
        fail("Timed out: " + condition + "\n" + evaluate("document.body.innerText"));
    }

    private void helpers() throws Exception {
        run("window.__click=(text,scope='body')=>{const e=[...document.querySelector(scope).querySelectorAll('button')].find(b=>b.textContent.trim()===text);if(!e)throw Error('Missing button '+text);e.click()};"
            + "window.__fill=(selector,value)=>{const e=document.querySelector(selector);if(!e)throw Error('Missing field '+selector);const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,value);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))}");
    }

    private void plan() throws Exception {
        run("__click('Budgets','.mobile-nav')");
        waitFor("document.querySelector('.plan-page')");
    }

    private void settings() throws Exception {
        run("__click('Settings','.mobile-nav')");
        waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Restore JSON')");
    }

    private void earnings(String amount) throws Exception {
        run("__click('Add earnings','.plan-actions')");
        waitFor("document.querySelector('[role=dialog] input[aria-label=\"Amount in PKR\"]')");
        run("__fill('[role=dialog] input[aria-label=\"Amount in PKR\"]'," + JSONObject.quote(amount) + ")");
        run("__click('Add to Savings','[role=dialog]')");
        waitFor("!document.querySelector('[role=dialog]')");
    }

    private void restore(String backup, boolean recovery) throws Exception {
        if (!recovery) {
            settings();
            run("__click('Restore JSON')");
            waitFor("document.querySelector('[role=dialog] textarea')");
        }
        run("__fill('textarea'," + JSONObject.quote(backup) + ")");
        run("__click('" + (recovery ? "Verify backup" : "Verify and preview") + "')");
        waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Restore this backup')");
        run("__click('Restore this backup')");
        waitFor("!document.querySelector('[role=dialog]') && document.querySelector('.mobile-nav') && !document.querySelector('.recovery-page')");
    }

    private void nativeCall(String method, JSONObject options) throws Exception {
        run("window.__bridgeTestResult=null;window.Capacitor.nativePromise('CapacitorSQLite',"
            + JSONObject.quote(method) + "," + options.toString()
            + ").then(value=>window.__bridgeTestResult=value).catch(error=>window.__bridgeTestResult={testError:error.message})");
        waitFor("window.__bridgeTestResult!==null");
        assertEquals("Native bridge rejected the test call: " + evaluate("window.__bridgeTestResult"), "false", evaluate("Boolean(window.__bridgeTestResult.testError)"));
    }

    private JSONObject query(String sql) throws Exception {
        return new JSONObject().put("database", "morrow").put("statement", sql)
            .put("values", new org.json.JSONArray()).put("readonly", false).put("isSQL92", true);
    }

    private long scalar(String sql) throws Exception {
        nativeCall("query", query("SELECT (" + sql + ") AS value"));
        return Long.parseLong(evaluate("window.__bridgeTestResult.values[0].value"));
    }

    private String ledgerRows() throws Exception {
        StringBuilder result = new StringBuilder();
        for (String table : new String[] {"categories", "templates", "budgets", "journal"}) {
            nativeCall("query", query("SELECT data FROM " + table + " ORDER BY id"));
            result.append(table).append(':').append(evaluate("window.__bridgeTestResult.values")).append('\n');
        }
        return result.toString();
    }

    private String read(File file) throws Exception {
        try (FileInputStream input = new FileInputStream(file); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] bytes = new byte[8192];
            int count;
            while ((count = input.read(bytes)) != -1) output.write(bytes, 0, count);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private String shell(String command) throws Exception {
        try (android.os.ParcelFileDescriptor descriptor = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
             FileInputStream input = new FileInputStream(descriptor.getFileDescriptor());
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] bytes = new byte[4096]; int count;
            while ((count = input.read(bytes)) != -1) output.write(bytes, 0, count);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    @Test(timeout = 90000)
    public void backupTokenIsEncryptedAndSurvivesActivityRecreation() throws Exception {
        assumeTrue("Disposable Android emulator required", Build.HARDWARE.contains("ranchu") || Build.HARDWARE.contains("goldfish"));
        scenario = ActivityScenario.launch(MainActivity.class);
        try {
            waitFor("document.querySelector('.plan-page')");
            run("window.__credentialCheck=null;window.Capacitor.nativePromise('BackupCredentials','save',{token:'synthetic-native-token'}).then(()=>window.__credentialCheck=true).catch(()=>window.__credentialCheck=false)");
            waitFor("window.__credentialCheck===true");
            String cipher = context.getSharedPreferences("morrow.backup.credentials", 0).getString("token", "");
            assertFalse(cipher.isEmpty()); assertFalse(cipher.contains("synthetic-native-token"));
            scenario.recreate(); waitFor("document.querySelector('.plan-page')");
            run("window.__credentialCheck=null;window.Capacitor.nativePromise('BackupCredentials','load',{}).then(value=>window.__credentialCheck=value.token==='synthetic-native-token').catch(()=>window.__credentialCheck=false)");
            waitFor("window.__credentialCheck===true");
            run("window.__credentialCheck=null;window.Capacitor.nativePromise('BackupCredentials','clear',{}).then(()=>window.Capacitor.nativePromise('BackupCredentials','load',{})).then(value=>window.__credentialCheck=value.token==='')");
            waitFor("window.__credentialCheck===true");
            if ("true".equals(InstrumentationRegistry.getArguments().getString("checkNetwork"))) {
                run("window.__httpCheck=null;window.Capacitor.nativePromise('CapacitorHttp','request',{url:'https://api.github.com/repos/HAQs-21/finance-tracker',method:'GET',headers:{Accept:'application/vnd.github+json'},responseType:'json',connectTimeout:15000,readTimeout:20000}).then(value=>window.__httpCheck=value.status).catch(()=>window.__httpCheck=-1)");
                waitFor("window.__httpCheck!==null");
                assertEquals("Native GitHub transport", "200", evaluate("window.__httpCheck"));
            }
            run("window.__copyCheck=null;window.Capacitor.nativePromise('MorrowClipboard','write',{text:'synthetic-export-note'}).then(()=>window.__copyCheck=true).catch(()=>window.__copyCheck=false)");
            waitFor("window.__copyCheck===true");
            android.content.ClipboardManager clipboard = (android.content.ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
            assertEquals("synthetic-export-note", clipboard.getPrimaryClip().getItemAt(0).getText().toString());
            clipboard.setPrimaryClip(android.content.ClipData.newPlainText("", ""));
        } finally { scenario.close(); context.getSharedPreferences("morrow.backup.credentials", 0).edit().clear().commit(); }
    }

    @Test(timeout = 120000)
    public void savingsRequiresDeviceCredentialAndClosesInBackground() throws Exception {
        assumeTrue("Disposable Android emulator required", Build.HARDWARE.contains("ranchu") || Build.HARDWARE.contains("goldfish"));
        assertTrue(shell("locksettings set-pin 1234").contains("set to"));
        scenario = ActivityScenario.launch(MainActivity.class);
        try {
            waitFor("document.querySelector('.plan-page')"); helpers();
            run("window.__privacyReload=true;localStorage.setItem('morrow.preferences',JSON.stringify({savingsProtection:'required'}));location.reload()");
            waitFor("!window.__privacyReload && document.querySelector('.plan-page')"); helpers();
            assertEquals("false", evaluate("Boolean(document.querySelector('.savings-detail'))"));
            run("document.querySelector('[aria-label=\"Open Savings\"]').click()");
            SystemClock.sleep(1000);
            assertEquals("false", evaluate("Boolean(document.querySelector('.savings-detail'))"));
            shell("input text 1234"); shell("input keyevent 66");
            waitFor("document.querySelector('.savings-detail')");
            scenario.onActivity(activity -> assertTrue((activity.getWindow().getAttributes().flags & android.view.WindowManager.LayoutParams.FLAG_SECURE) != 0));
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);
            waitFor("!document.querySelector('.savings-detail')");
            run("localStorage.removeItem('morrow.preferences')");
        } finally {
            scenario.close();
            shell("locksettings clear --old 1234");
        }
    }

    @Test(timeout = 240000)
    public void startupSpendingExportRestoreAndDamagedDatabaseRecovery() throws Exception {
        // Never mutate a person's phone. The CLI invocation additionally targets one emulator serial.
        assumeTrue("Disposable Android emulator required", Build.HARDWARE.contains("ranchu") || Build.HARDWARE.contains("goldfish"));
        context.deleteDatabase("morrowSQLite.db");
        File exported = new File(context.getCacheDir(), "exports/Morrow-recovery.json");
        if (exported.exists()) assertTrue(exported.delete());
        scenario = ActivityScenario.launch(MainActivity.class);
        try {
            waitFor("document.querySelector('.plan-page')");
            helpers();
            assertEquals(7, scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('metadata','archives','categories','templates','budgets','journal','recoveries')"));
            // Successful startup itself regresses the PRAGMA-through-execSQL crash.
            earnings("40000");
            run("__click('New budget')");
            waitFor("document.querySelector('select[aria-label=\"Budget category\"]')");
            run("__fill('select[aria-label=\"Budget category\"]',[...document.querySelector('select[aria-label=\"Budget category\"]').options].find(o=>o.textContent==='Food').value)");
            run("__fill('input[aria-label=\"Monthly budget amount\"]','8000')");
            run("__click('Create budget','[role=dialog]')");
            waitFor("!document.querySelector('[role=dialog]') && document.querySelector('.budget-card')");
            run("__click('Add expense','.budget-card')");
            waitFor("document.querySelector('input[aria-label=\"Amount in PKR\"]')");
            run("__fill('input[aria-label=\"Amount in PKR\"]','1200')");
            run("__fill('input[aria-label=\"Transaction note\"]','Native lunch — اردو')");
            run("__click('Record expense','[role=dialog]')");
            waitFor("!document.querySelector('[role=dialog]')");
            assertEquals(3200000, scalar("SELECT SUM(savingsDelta) FROM journal"));
            assertEquals(680000, scalar("SELECT SUM(budgetDelta) FROM journal"));
            String original = ledgerRows();
            scenario.recreate();
            waitFor("document.querySelector('.plan-page')");
            helpers();
            assertEquals(original, ledgerRows());

            // Exercise the actual native export, not a manually constructed Morrow backup.
            settings();
            run("__click('Complete JSON')");
            long deadline = SystemClock.uptimeMillis() + 15000;
            while (!exported.isFile() && SystemClock.uptimeMillis() < deadline) SystemClock.sleep(100);
            assertTrue("Native recovery export was not written", exported.isFile());
            String complete = read(exported);
            assertEquals("morrow-backup", new JSONObject(complete).getString("format"));
            SystemClock.sleep(700);
            InstrumentationRegistry.getInstrumentation().getUiAutomation().injectInputEvent(new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_BACK), true);
            InstrumentationRegistry.getInstrumentation().getUiAutomation().injectInputEvent(new KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_BACK), true);
            SystemClock.sleep(300);
            context.startActivity(context.getPackageManager().getLaunchIntentForPackage(context.getPackageName()).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK));
            plan();
            earnings("5000");
            assertEquals(3700000, scalar("SELECT SUM(savingsDelta) FROM journal"));
            restore(complete, false);
            assertEquals(original, ledgerRows());
            assertTrue(scalar("SELECT COUNT(*) FROM recoveries") > 0);

            // Legacy Finance Tracker JSON must also restore through the native adapter.
            String legacy = "{\"transactions\":[{\"id\":1,\"type\":\"INCOME\",\"amount\":40000,\"date\":\"DATE\",\"description\":\"Legacy earnings\"},{\"id\":2,\"type\":\"EXPENSE\",\"amount\":3000,\"category\":\"Food\",\"date\":\"DATE\",\"description\":\"Legacy lunch — اردو\"}],\"budgets\":[{\"category\":\"Food@MONTH\",\"amount\":8000,\"month\":\"MONTH\"}],\"savings\":[]}";
            String date = new JSONObject("{\"date\":" + evaluate("new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-'+String(new Date().getDate()).padStart(2,'0')") + "}").getString("date");
            legacy = legacy.replace("DATE", date).replace("MONTH", date.substring(0, 7));
            restore(legacy, false);
            assertEquals(3200000, scalar("SELECT SUM(savingsDelta) FROM journal"));
            assertEquals(500000, scalar("SELECT SUM(budgetDelta) FROM journal"));
            assertEquals(1, scalar("SELECT COUNT(*) FROM archives WHERE id='legacy'"));

            // Simulate metadata damage on this disposable database, keeping all rows in place.
            JSONObject damage = query("UPDATE metadata SET data = ? WHERE key = 'state'")
                .put("values", new org.json.JSONArray().put("{\"invalid\":true}")).put("transaction", true);
            nativeCall("run", damage);
            scenario.recreate();
            waitFor("document.querySelector('.recovery-page')");
            helpers();
            restore(complete, true);
            assertEquals(original, ledgerRows());
            assertTrue(scalar("SELECT COUNT(*) FROM recoveries WHERE reason='Raw database before recovery restore'") > 0);
            scenario.recreate();
            waitFor("document.querySelector('.mobile-nav') && !document.querySelector('.recovery-page')");
            assertEquals(original, ledgerRows());
        } finally {
            scenario.close();
        }
    }
}
