export function cn(...inputs) {
  return inputs.filter(Boolean).join(" ");
}

export function sanitizeForJSON(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  // Detect and break circular references using a Set for visited objects
  const visited = new Set();
  
  function clean(val) {
    if (val === null || val === undefined) return val;
    if (typeof val === "function") return undefined;
    if (typeof val !== "object") return val;
    
    // Handle Firestore Timestamp specifically (has seconds, nanoseconds, and toDate)
    if (typeof val.toDate === "function") {
      try {
        return val.toDate().toISOString();
      } catch (e) {
        // fallback
      }
    }
    
    // Handle Date
    if (val instanceof Date) {
      return val.toISOString();
    }

    // Handle DOM elements
    if (typeof window !== "undefined") {
      if (
        val instanceof Element || 
        val instanceof HTMLImageElement || 
        val instanceof window.HTMLElement || 
        (val.nodeType !== undefined && val.nodeName !== undefined) ||
        (val.ownerDocument && val.tagName)
      ) {
        return `[DOM Element: ${val.nodeName || val.tagName || "element"}]`;
      }
    }

    // Handle React elements (with $$typeof symbol) or internals (FiberNode, SyntheticEvent, etc.)
    const constructorName = val.constructor && typeof val.constructor.name === "string" ? val.constructor.name : "";
    if (
      val.$$typeof || 
      constructorName.includes("Fiber") || 
      constructorName.includes("Event") || 
      constructorName.includes("React") ||
      val._reactName ||
      val._targetInst ||
      val.nativeEvent
    ) {
      return "[React Internal/Event]";
    }
    
    if (visited.has(val)) {
      return "[Circular]";
    }
    visited.add(val);
    
    if (Array.isArray(val)) {
      const res = val.map(item => clean(item));
      visited.delete(val);
      return res;
    }
    
    const res = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        // Skip react/internal keys or event details
        if (
          key.startsWith("_") || 
          key.startsWith("__") ||
          key === "updater" || 
          key === "current" ||
          key === "target" ||
          key === "currentTarget" ||
          key === "nativeEvent"
        ) {
          continue;
        }

        const itemVal = val[key];
        if (typeof itemVal === "function") continue;

        if (itemVal && typeof itemVal === "object") {
          const itemConstructor = itemVal.constructor && typeof itemVal.constructor.name === "string" ? itemVal.constructor.name : "";
          if (
            itemVal.$$typeof || 
            itemConstructor.includes("Fiber") || 
            itemConstructor.includes("Event") || 
            itemConstructor.includes("React")
          ) {
            continue;
          }
        }
        
        res[key] = clean(itemVal);
      }
    }
    visited.delete(val);
    return res;
  }
  
  return clean(obj);
}

