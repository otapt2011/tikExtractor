// worker.js – uses extractGeneric for custom types
importScripts('extractor.js');

let extractor = null;

function getNested(obj, keys) {
  let cur = obj;
  for (const k of keys) {
    if (cur && typeof cur === "object" && k in cur) cur = cur[k];
    else return null;
  }
  return cur;
}

function sendProgress(step, current, total, message) {
  self.postMessage({ type: 'progress', step, current, total, message });
}

self.addEventListener('message', async function(e) {
  const { jsonData, currentUser, enabled, dataTypes } = e.data;
  try {
    if (!extractor) {
      if (typeof TikTokExtractor === 'undefined') throw new Error('TikTokExtractor not loaded');
      extractor = TikTokExtractor;
    }
    
    // FIX: Apply custom paths from dataTypes configuration before any extraction
    if (dataTypes) {
      dataTypes.forEach(type => {
        if (type.defaultPath && Array.isArray(type.defaultPath)) {
          extractor.setPath(type.id, type.defaultPath);
        }
      });
    }
    
    let finalUser = currentUser;
    if (!finalUser) {
      const detected = extractor.extractCurrentUser(jsonData);
      if (detected) finalUser = detected;
    }
    if (finalUser) extractor.setCurrentUser(finalUser);
    
    const result = {};
    const enabledTypes = dataTypes.filter(t => enabled[t.id]);
    const totalSteps = enabledTypes.length;
    let stepIndex = 0;
    
    for (const type of enabledTypes) {
      stepIndex++;
      sendProgress(type.id, stepIndex, totalSteps, `Extracting ${type.label}...`);
      
      if (type.isComputed && type.id === 'friends') {
        if (enabled.following && enabled.follower) {
          result.friends = extractor.extractFriends(jsonData);
        } else {
          result.friends = [];
        }
        continue;
      }
      
      // Try to call a specific extractor function (e.g., extractProfile)
      const fnName = `extract${type.id.charAt(0).toUpperCase() + type.id.slice(1)}`;
      if (typeof extractor[fnName] === 'function') {
        result[type.id] = extractor[fnName](jsonData);
      } else if (type.defaultPath && Array.isArray(type.defaultPath)) {
        // Use generic extraction with the provided path
        result[type.id] = extractor.extractGeneric(jsonData, type);
      } else {
        // No extraction method and no path – return empty array
        result[type.id] = [];
      }
    }
    
    // Count N/A entries (for following, follower, blocked only)
    function countNA(pathKeys) {
      const list = getNested(jsonData, pathKeys);
      if (!Array.isArray(list)) return 0;
      return list.filter(item => item.UserName === "N/A").length;
    }
    const followingPath = extractor.getPath('following') || ["Profile And Settings", "Following", "Following"];
    const followerPath = extractor.getPath('follower') || ["Profile And Settings", "Follower", "FansList"];
    const blockedPath = extractor.getPath('blocked') || ["Profile And Settings", "Block List", "BlockList"];
    const followingNA = countNA(followingPath);
    const followerNA = countNA(followerPath);
    const blockedNA = countNA(blockedPath);
    
    const profile = result.profile?.[0] || {};
    const totalLikes = (result.post || []).reduce((s, p) => s + (Number(p.likes) || 0), 0);
    const validation = {
      following: { extracted: result.following?.length || 0, profile: profile.followingCount || 0, match: (result.following?.length || 0) === (profile.followingCount || 0) },
      follower: { extracted: result.follower?.length || 0, profile: profile.followerCount || 0, match: (result.follower?.length || 0) === (profile.followerCount || 0) },
      likes: { extracted: totalLikes, profile: profile.likesReceived || 0, match: totalLikes === (profile.likesReceived || 0) },
      naRemoved: { following: followingNA, follower: followerNA, blocked: blockedNA }
    };
    result.currentUserUsed = extractor.getCurrentUser();
    result.validation = validation;
    self.postMessage({ type: 'complete', success: true, data: result });
  } catch (err) {
    self.postMessage({ type: 'complete', success: false, error: err.message });
  }
});