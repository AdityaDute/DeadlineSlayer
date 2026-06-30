"use client";

import React, { useState } from "react";
import styles from "./TerminalLogs.module.css";
import { Terminal, FileCode, CheckCircle, Copy, AlertTriangle } from "lucide-react";

export default function TerminalLogs({ 
  logs = [], 
  artifact = "", 
  isExecuting = false,
  error = null
}) {
  const [activeTab, setActiveTab] = useState("logs");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!artifact) return;
    navigator.clipboard.writeText(artifact);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.container} id="compiler-logs-panel">
      {/* Tabs Menu */}
      <div className={styles.tabsHeader}>
        <div className={styles.tabButtons}>
          <button 
            onClick={() => setActiveTab("logs")}
            className={`${styles.tabBtn} ${activeTab === "logs" ? styles.activeTab : ""}`}
            id="tab-btn-logs"
          >
            <Terminal size={14} />
            <span>EXECUTION_LOGS</span>
          </button>
          <button 
            onClick={() => setActiveTab("artifact")}
            disabled={!artifact}
            className={`${styles.tabBtn} ${activeTab === "artifact" ? styles.activeTab : ""}`}
            id="tab-btn-artifact"
          >
            <FileCode size={14} />
            <span>GENERATED_ARTIFACT</span>
            {artifact && <span className={styles.badge}>NEW</span>}
          </button>
        </div>

        {activeTab === "artifact" && artifact && (
          <button onClick={handleCopy} className={styles.copyBtn} id="copy-artifact-btn">
            {copied ? (
              <>
                <CheckCircle size={12} style={{ color: "var(--success)" }} />
                <span style={{ color: "var(--success)" }}>COPIED!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>COPY</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Terminal Display */}
      <div className={styles.displayArea}>
        {error ? (
          <div className={styles.errorContainer}>
            <AlertTriangle size={24} className={styles.errorIcon} />
            <h4 className={styles.errorTitle}>EXECUTION FAILURE</h4>
            <p className={styles.errorMsg}>{error}</p>
          </div>
        ) : activeTab === "logs" ? (
          <div className={styles.logsConsole}>
            {logs.length === 0 ? (
              <div className={styles.emptyLogs}>
                {isExecuting ? (
                  <div className={styles.executingLoader}>
                    <div className={styles.spinner} />
                    <span>Agent is hard at work compiling files and running tests...</span>
                  </div>
                ) : (
                  <span>No active execution logs. Select a task below and trigger &ldquo;Execute Task&rdquo;.</span>
                )}
              </div>
            ) : (
              <div className={styles.logLines}>
                {logs.map((log, index) => (
                  <div key={index} className={styles.logLine} id={`exec-log-line-${index}`}>
                    <span className={styles.lineIndex}>{(index + 1).toString().padStart(2, "0")}</span>
                    <span className={styles.lineContent}>{log}</span>
                  </div>
                ))}
                {isExecuting && (
                  <div className={styles.activeLine}>
                    <span className={styles.lineIndex}>{(logs.length + 1).toString().padStart(2, "0")}</span>
                    <span className={styles.blinkCursor}>▋</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.artifactContainer}>
            <pre className={styles.codeBlock}>
              <code>{artifact}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
