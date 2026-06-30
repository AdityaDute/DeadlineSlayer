"use client";

import React, { useState, useEffect } from "react";
import styles from "./ExecutorOutput.module.css";
import { 
  Sparkles, 
  Terminal, 
  Play, 
  CheckCircle, 
  Copy, 
  AlertTriangle, 
  RefreshCw, 
  Send, 
  Clipboard, 
  Edit, 
  Check, 
  ArrowRight, 
  Loader,
  Clock,
  Calendar,
  Layers
} from "lucide-react";

// Inline Markdown rendering parser
function parseInlineStyles(text) {
  if (!text) return "";
  
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const splitParts = text.split(regex);
  
  return splitParts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={idx} className={styles.inlineCode}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className={styles.bold}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={idx} className={styles.italic}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

// Simple Custom Markdown Renderer
function MarkdownRenderer({ text }) {
  if (!text) return null;

  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className={styles.markdown}>
      {parts.map((part, partIdx) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const codeLines = part.slice(3, -3).split("\n");
          let language = "code";
          if (codeLines[0] && !codeLines[0].includes(" ") && codeLines[0].length < 15) {
            language = codeLines[0];
            codeLines.shift();
          }
          const codeContent = codeLines.join("\n").trim();
          return (
            <CodeViewer key={partIdx} code={codeContent} language={language} />
          );
        }

        const lines = part.split("\n");
        let listBuffer = [];
        let listType = null; // 'bullet' | 'number'
        const elements = [];

        const flushList = (key) => {
          if (listBuffer.length === 0) return;
          if (listType === "bullet") {
            elements.push(
              <ul key={`ul-${key}`} className={styles.bulletList}>
                {listBuffer.map((item, idx) => (
                  <li key={idx}>{parseInlineStyles(item)}</li>
                ))}
              </ul>
            );
          } else if (listType === "number") {
            elements.push(
              <ol key={`ol-${key}`} className={styles.numberedList}>
                {listBuffer.map((item, idx) => (
                  <li key={idx}>{parseInlineStyles(item)}</li>
                ))}
              </ol>
            );
          }
          listBuffer = [];
          listType = null;
        };

        lines.forEach((line, lineIdx) => {
          const trimmed = line.trim();

          if (trimmed.startsWith("# ")) {
            flushList(lineIdx);
            elements.push(<h1 key={lineIdx} className={styles.h1}>{parseInlineStyles(trimmed.slice(2))}</h1>);
          } else if (trimmed.startsWith("## ")) {
            flushList(lineIdx);
            elements.push(<h2 key={lineIdx} className={styles.h2}>{parseInlineStyles(trimmed.slice(3))}</h2>);
          } else if (trimmed.startsWith("### ")) {
            flushList(lineIdx);
            elements.push(<h3 key={lineIdx} className={styles.h3}>{parseInlineStyles(trimmed.slice(4))}</h3>);
          } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            if (listType && listType !== "bullet") {
              flushList(lineIdx);
            }
            listType = "bullet";
            listBuffer.push(trimmed.slice(2));
          } else if (/^\d+\.\s/.test(trimmed)) {
            if (listType && listType !== "number") {
              flushList(lineIdx);
            }
            listType = "number";
            const match = trimmed.match(/^\d+\.\s(.*)/);
            listBuffer.push(match ? match[1] : trimmed);
          } else if (trimmed === "") {
            flushList(lineIdx);
            elements.push(<div key={lineIdx} className={styles.spacer} />);
          } else {
            flushList(lineIdx);
            elements.push(<p key={lineIdx} className={styles.paragraph}>{parseInlineStyles(line)}</p>);
          }
        });

        flushList(lines.length);
        return <React.Fragment key={partIdx}>{elements}</React.Fragment>;
      })}
    </div>
  );
}

import { useToast } from "./Toast";

// Monospace Code Viewer Component
function CodeViewer({ code, language = "code" }) {
  const [copied, setCopied] = useState(false);
  const showToast = useToast();

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    showToast("Code block copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.codeBlockWrapper}>
      <div className={styles.codeBlockHeader}>
        <span className={styles.codeLang}>{language.toUpperCase()}</span>
        <button onClick={handleCopy} className={styles.copyBlockBtn}>
          {copied ? <Check size={12} className={styles.successColor} /> : <Copy size={12} />}
          <span>{copied ? "COPIED" : "COPY CODE"}</span>
        </button>
      </div>
      <pre className={styles.codePre}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function ExecutorOutput({ 
  output, 
  onClose, 
  onUseThis, 
  onRefine, 
  onRegenerate,
  isLoading = false
}) {
  const showToast = useToast();
  const [isFlipped, setIsFlipped] = useState({});
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [refineFeedback, setRefineFeedback] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);

  const {
    taskTitle = "Task Slaying Solution",
    productType = "draft",
    content = "",
    keyPoints = [],
    estimatedTimeSaved = "~2 hours",
    nextSteps = [],
    taskId = null
  } = output || {};

  // Custom Flashcard Q&A Parser
  const parseFlashcards = (text) => {
    const cards = [];
    const blocks = text.split(/(?:\n\s*\n|\n---\n)/);
    for (const block of blocks) {
      if (!block.trim()) continue;
      const qMatch = block.match(/(?:Q:|Question:|\*\*Q\*\*|\*\*Question\*\*|- Q:|- \*\*Q:\*\*)\s*([^\n]+)/i);
      const aMatch = block.match(/(?:A:|Answer:|\*\*A\*\*|\*\*Answer\*\*|- A:|- \*\*A:\*\*)\s*([^\n]+)/i);
      if (qMatch && aMatch) {
        cards.push({
          front: qMatch[1].trim(),
          back: aMatch[1].trim()
        });
      }
    }
    if (cards.length === 0) {
      const lines = text.split("\n");
      let currentQ = null;
      for (const line of lines) {
        const qMatch = line.match(/(?:Q:|Question:|\*\*Q:\*\*|\*\*Question:\*\*)\s*(.+)/i);
        const aMatch = line.match(/(?:A:|Answer:|\*\*A:\*\*|\*\*Answer:\*\*)\s*(.+)/i);
        if (qMatch) {
          currentQ = qMatch[1].trim();
        } else if (aMatch && currentQ) {
          cards.push({ front: currentQ, back: aMatch[1].trim() });
          currentQ = null;
        }
      }
    }
    if (cards.length === 0) {
      return [{ front: "Core Summary Concept", back: text }];
    }
    return cards;
  };

  // Custom Email Headers Parser
  const parseEmail = (text) => {
    const lines = text.split("\n");
    let to = "recipient@example.com";
    let subject = "Urgent Request: Core Scope Delivery Updates";
    let bodyLines = [];
    let bodyStarted = false;

    for (const line of lines) {
      if (!bodyStarted) {
        const toMatch = line.match(/^To:\s*(.*)/i);
        const subMatch = line.match(/^Subject:\s*(.*)/i);
        if (toMatch) {
          to = toMatch[1].trim();
          continue;
        }
        if (subMatch) {
          subject = subMatch[1].trim();
          continue;
        }
        if (line.trim() !== "" && !line.toLowerCase().startsWith("to:") && !line.toLowerCase().startsWith("subject:")) {
          bodyStarted = true;
        }
      }
      if (bodyStarted) {
        bodyLines.push(line);
      }
    }

    return {
      to,
      subject,
      body: bodyLines.join("\n").trim()
    };
  };

  const handleFlipCard = (idx) => {
    setIsFlipped(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(content);
    setCopiedAll(true);
    showToast("Solution content copied to clipboard!", "success");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyEmail = (emailObj) => {
    const textToCopy = `To: ${emailObj.to}\nSubject: ${emailObj.subject}\n\n${emailObj.body}`;
    navigator.clipboard.writeText(textToCopy);
    showToast("Email draft copied to clipboard!", "success");
  };

  const submitRefinement = (e) => {
    e.preventDefault();
    if (!refineFeedback.trim()) return;
    onRefine(refineFeedback);
    setRefineFeedback("");
    setShowRefineInput(false);
  };

  const handleUseThisClick = async () => {
    try {
      await onUseThis(output);
      showToast("Success! Saved AI draft and updated task status to In Progress!", "success");
    } catch (err) {
      console.error("Failed to commit task draft:", err);
      showToast("Could not save task draft.", "error");
    }
  };

  // Safe generation timestamp
  const [genTime] = useState(() => {
    const date = new Date();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    return `${hours % 12 || 12}:${minutes} ${ampm}`;
  });

  return (
    <div className={styles.container} id="executor-output-panel">


      {/* Header Panel */}
      <div className={styles.header}>
        <div className={styles.headerTitleArea}>
          <div className={styles.badgeRow}>
            <span className={styles.aiBadge}>
              <Sparkles size={12} />
              <span>⚡ AI GENERATED</span>
            </span>
            <span className={styles.typeBadge}>
              {productType.toUpperCase()}
            </span>
          </div>
          <h2 className={styles.title}>{taskTitle}</h2>
        </div>
        <button onClick={onClose} className={styles.closeBtn} id="close-executor-panel-btn">✕</button>
      </div>

      {/* Loader Cover */}
      {isLoading ? (
        <div className={styles.loadingWrapper}>
          <Loader size={36} className={styles.spinner} />
          <p className={styles.loadingText}>Executor Agent compiling your tactical asset...</p>
        </div>
      ) : (
        <div className={styles.scrollArea}>
          {/* Main Visual Display based on type */}
          <div className={styles.contentBody}>
            {productType === "flashcards" ? (
              <div className={styles.flashcardsGrid}>
                {parseFlashcards(content).map((card, idx) => {
                  const flipped = !!isFlipped[idx];
                  return (
                    <div 
                      key={idx} 
                      onClick={() => handleFlipCard(idx)}
                      className={`${styles.flashcard} ${flipped ? styles.flippedCard : ""}`}
                      id={`flashcard-node-${idx}`}
                    >
                      <div className={styles.cardInner}>
                        {/* Front (Blue tint) */}
                        <div className={styles.cardFront}>
                          <span className={styles.cardIndex}>CARD {idx + 1} • CLICK TO FLIP</span>
                          <p className={styles.cardContentText}>{card.front}</p>
                        </div>
                        {/* Back (Purple tint) */}
                        <div className={styles.cardBack}>
                          <span className={styles.cardIndex}>ANSWER • CLICK TO REVERT</span>
                          <p className={styles.cardContentText}>{card.back}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : productType === "email" ? (
              (() => {
                const emailObj = parseEmail(content);
                return (
                  <div className={styles.emailContainer}>
                    <div className={styles.emailHeader}>
                      <div className={styles.emailRow}>
                        <span className={styles.emailLabel}>TO:</span>
                        <span className={styles.emailValue}>{emailObj.to}</span>
                      </div>
                      <div className={styles.emailRow}>
                        <span className={styles.emailLabel}>SUBJECT:</span>
                        <span className={styles.emailValue}>{emailObj.subject}</span>
                      </div>
                      <button 
                        onClick={() => handleCopyEmail(emailObj)}
                        className={styles.copyEmailBtn}
                      >
                        📧 Copy Email
                      </button>
                    </div>
                    <div className={styles.emailBody}>
                      <MarkdownRenderer text={emailObj.body} />
                    </div>
                  </div>
                );
              })()
            ) : productType === "code" ? (
              <CodeViewer code={content} language="javascript" />
            ) : (
              <MarkdownRenderer text={content} />
            )}
          </div>

          {/* Key Deliverable Takeaways */}
          {keyPoints.length > 0 && (
            <div className={styles.highlightsBox}>
              <h4 className={styles.subTitle}>
                <Layers size={13} />
                <span>CORE DELIVERABLES</span>
              </h4>
              <ul className={styles.takeawayList}>
                {keyPoints.map((pt, idx) => (
                  <li key={idx} className={styles.takeawayItem}>
                    <Check size={12} className={styles.successColor} />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Control Buttons Bar */}
          <div className={styles.actionBar}>
            <button 
              onClick={handleUseThisClick} 
              className={styles.useThisBtn}
              id="executor-use-btn"
            >
              <CheckCircle size={16} />
              <span>Use This</span>
            </button>
            
            <button 
              onClick={() => setShowRefineInput(!showRefineInput)} 
              className={styles.outlineBtn}
              id="executor-refine-btn"
            >
              <Edit size={14} />
              <span>Refine</span>
            </button>

            <button 
              onClick={onRegenerate} 
              className={styles.outlineBtn}
              id="executor-regenerate-btn"
            >
              <RefreshCw size={14} />
              <span>Regenerate</span>
            </button>

            <button 
              onClick={handleCopyAll} 
              className={styles.outlineBtn}
              id="executor-copy-all-btn"
            >
              {copiedAll ? <Check size={14} className={styles.successColor} /> : <Clipboard size={14} />}
              <span>{copiedAll ? "Copied!" : "Copy All"}</span>
            </button>
          </div>

          {/* Feedback Form Slider */}
          {showRefineInput && (
            <form onSubmit={submitRefinement} className={styles.refineForm} id="executor-refine-form">
              <input 
                type="text" 
                value={refineFeedback}
                onChange={(e) => setRefineFeedback(e.target.value)}
                placeholder="Suggest adjustments (e.g. 'Make it shorter', 'Add a technical example')..."
                className={styles.refineInput}
                autoFocus
              />
              <button type="submit" className={styles.refineSubmitBtn}>
                <Send size={14} />
              </button>
            </form>
          )}

          {/* Next Steps List */}
          {nextSteps.length > 0 && (
            <div className={styles.nextStepsBox}>
              <h4 className={styles.subTitle}>NEXT RECOMMENDED ACTIONS</h4>
              <div className={styles.nextStepsTimeline}>
                {nextSteps.map((step, idx) => (
                  <div key={idx} className={styles.nextStepRow}>
                    <div className={styles.nextStepBadge}>{idx + 1}</div>
                    <p className={styles.nextStepText}>{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta Information Details Footer */}
          <div className={styles.metaBox}>
            <div className={styles.metaRow}>
              <Clock size={12} />
              <span>Estimated time saved: {estimatedTimeSaved}</span>
            </div>
            <div className={styles.metaRow}>
              <Calendar size={12} />
              <span>Generated by Executor Agent at {genTime}</span>
            </div>
            <div className={styles.metaRow}>
              <ArrowRight size={12} />
              <span>Next steps: Review the draft, customize for your context, submit</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
