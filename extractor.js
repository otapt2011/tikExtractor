/**
 * extractor.js – added generic extraction for custom paths
 * Supports both named extractors and generic path‑based extraction.
 */
(function(global) {
  "use strict";

  const DEFAULT_PATHS = {
    messages:        ["Direct Message", "Direct Messages", "ChatHistory"],
    comment:   ["Comment", "Comments", "CommentsList"],
    post:      ["Post", "Posts", "VideoList"],
    following: ["Profile And Settings", "Following", "Following"],
    follower:  ["Profile And Settings", "Follower", "FansList"],
    blocked:   ["Profile And Settings", "Block List", "BlockList"],
    profile:   ["Profile And Settings", "Profile Info", "ProfileMap"]
  };

  let currentPaths = {
    messages:        [...DEFAULT_PATHS.messages],
    comment:   [...DEFAULT_PATHS.comment],
    post:      [...DEFAULT_PATHS.post],
    following: [...DEFAULT_PATHS.following],
    follower:  [...DEFAULT_PATHS.follower],
    blocked:   [...DEFAULT_PATHS.blocked],
    profile:   [...DEFAULT_PATHS.profile]
  };

  let fieldMappings = {
    messages:      { date: "Date", from: "From", content: "Content" },
    comment: { date: "date", comment: "comment", photo: "photo", url: "url" },
    post:    { date: "Date", likes: "Likes", coverImage: "CoverImage" },
    following: null,
    follower:  null,
    blocked:   null,
    profile:   null
  };

  let itemMappers = {
    messages: null, comment: null, post: null,
    following: null, follower: null, blocked: null, profile: null
  };

  let currentUser = "";
  let skipOnMissingPath = true;

  // ----- helpers -----
  function getNested(obj, keys) {
    let cur = obj;
    for (const k of keys) {
      if (cur && typeof cur === "object" && k in cur) cur = cur[k];
      else return null;
    }
    return cur;
  }

  function safeGetNested(obj, keys, context) {
    const result = getNested(obj, keys);
    if (result === null && !skipOnMissingPath) {
      throw new Error(`Path not found for ${context}: ${keys.join(" → ")}`);
    }
    return result;
  }

  function applyMapping(item, mapping, extraFields = {}) {
    if (!mapping) return { ...item, ...extraFields };
    const result = {};
    for (const [target, source] of Object.entries(mapping)) {
      result[target] = item[source] || "";
    }
    return { ...result, ...extraFields };
  }

  // ----- generic extraction for custom types -----
  function extractGeneric(data, typeConfig) {
    const { id, defaultPath, fieldMapping, itemMapper, needsCurrentUser } = typeConfig;
    // Use custom path if set via setPath, otherwise defaultPath
    const path = currentPaths[id] || defaultPath;
    if (!path || !Array.isArray(path)) return [];

    let items = safeGetNested(data, path, id);
    if (!Array.isArray(items)) items = [];

    // Special filtering for following/follower (remove N/A)
    if (id === 'following' || id === 'follower') {
      items = items.filter(item => item.UserName !== "N/A");
    }

    // Apply field mapping (if provided)
    const mapping = fieldMappings[id] || fieldMapping;
    if (mapping) {
      items = items.map(item => applyMapping(item, mapping));
    }

    // Apply custom item mapper (if provided)
    const mapper = itemMappers[id] || itemMapper;
    if (mapper && typeof mapper === 'function') {
      items = items.map(mapper);
    }

    // DM special case (handled separately, but keep generic fallback simple)
    return items;
  }

  // ----- existing extraction functions -----
  function extractProfile(data) {
    const profileMap = safeGetNested(data, currentPaths.profile, "Profile");
    if (!profileMap || typeof profileMap !== "object") return [];
    const profile = {
      bioDescription:  profileMap.bioDescription || "",
      birthDate:       profileMap.birthDate || "",
      displayName:     profileMap.displayName || "",
      emailAddress:    profileMap.emailAddress || "",
      followerCount:   profileMap.followerCount || 0,
      followingCount:  profileMap.followingCount || 0,
      likesReceived:   profileMap.likesReceived || 0,
      profilePhoto:    profileMap.profilePhoto || "",
      telephoneNumber: profileMap.telephoneNumber || "",
      userName:        profileMap.userName || ""
    };
    return [profile];
  }

  function extractCurrentUserFromJson(data) {
    const profileArray = extractProfile(data);
    if (profileArray.length > 0 && profileArray[0].userName) {
      return profileArray[0].userName;
    }
    return null;
  }

  function autoSetCurrentUserFromJson(data) {
    const detected = extractCurrentUserFromJson(data);
    if (detected) {
      currentUser = detected;
      return true;
    }
    return false;
  }

  function extractMessages(data) {
  const chatHistory = safeGetNested(data, currentPaths.messages, "DM");
  if (!chatHistory) return [];
  const allMessages = [];
  for (const [key, messages] of Object.entries(chatHistory)) {
    const prefix = "Chat History with ";
    if (!key.startsWith(prefix)) continue;
    let participant = key.slice(prefix.length);
    participant = participant.replace(/:$/, '').trim(); // <-- fix here
    if (!Array.isArray(messages)) continue;
    for (const msg of messages) {
      let enhanced = applyMapping(msg, fieldMappings.messages);
      const from = msg.From || enhanced.From;
      const to = (from === participant) ? currentUser : participant;
      allMessages.push({ ...enhanced, to: to });
    }
  }
  if (itemMappers.messages) return allMessages.map(itemMappers.messages);
  return allMessages;
}

  function extractComment(data) {
    const commentsList = safeGetNested(data, currentPaths.comment, "Comment");
    if (!Array.isArray(commentsList)) return [];
    let result = commentsList.map(item => applyMapping(item, fieldMappings.comment));
    if (itemMappers.comment) result = result.map(itemMappers.comment);
    return result;
  }

  function extractPost(data) {
    const videoList = safeGetNested(data, currentPaths.post, "Post");
    if (!Array.isArray(videoList)) return [];
    let result = videoList.map(item => applyMapping(item, fieldMappings.post));
    if (itemMappers.post) result = result.map(itemMappers.post);
    return result;
  }

  function extractFollowing(data) {
    let list = safeGetNested(data, currentPaths.following, "Following");
    if (!Array.isArray(list)) return [];
    list = list.filter(item => item.UserName !== "N/A");
    if (itemMappers.following) list = list.map(itemMappers.following);
    return list;
  }

  function extractFollower(data) {
    let list = safeGetNested(data, currentPaths.follower, "Follower");
    if (!Array.isArray(list)) return [];
    list = list.filter(item => item.UserName !== "N/A");
    if (itemMappers.follower) list = list.map(itemMappers.follower);
    return list;
  }

  function extractBlocked(data) {
    let list = safeGetNested(data, currentPaths.blocked, "Blocked");
    if (!Array.isArray(list)) return [];
    if (itemMappers.blocked) list = list.map(itemMappers.blocked);
    return list;
  }

  function extractFriends(data) {
    const following = extractFollowing(data);
    const follower = extractFollower(data);
    const followerMap = new Map();
    for (const f of follower) {
      const name = f.UserName;
      if (name && !followerMap.has(name)) followerMap.set(name, f.Date);
    }
    const friends = [];
    for (const f of following) {
      const name = f.UserName;
      if (name && followerMap.has(name)) {
        friends.push({
          UserName: name,
          FollowingDate: f.Date,
          FollowerDate: followerMap.get(name)
        });
      }
    }
    return friends;
  }

  // ----- public API -----
  const TikTokExtractor = {
    extractMessages, extractComment, extractPost, extractFollowing,
    extractFollower, extractBlocked, extractFriends, extractProfile,
    extractGeneric,
    setCurrentUser: function(username) {
      if (typeof username === "string" && username.trim()) {
        currentUser = username.trim();
      }
    },
    getCurrentUser: function() { return currentUser; },
    autoSetCurrentUserFromJson,
    extractCurrentUser: extractCurrentUserFromJson,
    setPath: function(type, keys) {
      if (currentPaths.hasOwnProperty(type) && Array.isArray(keys) && keys.length >= 3) {
        currentPaths[type] = [...keys];
      } else {
        console.warn(`setPath: invalid type or keys for "${type}"`);
      }
    },
    getPath: function(type) { return currentPaths[type] ? [...currentPaths[type]] : null; },
    setFieldMapping: function(type, mapping) {
      if (currentPaths.hasOwnProperty(type) && mapping && typeof mapping === "object") {
        fieldMappings[type] = { ...fieldMappings[type], ...mapping };
      } else {
        console.warn(`setFieldMapping: invalid type or mapping for "${type}"`);
      }
    },
    getFieldMapping: function(type) { return fieldMappings[type] ? { ...fieldMappings[type] } : null; },
    setItemMapper: function(type, mapperFn) {
      if (currentPaths.hasOwnProperty(type) && typeof mapperFn === "function") {
        itemMappers[type] = mapperFn;
      } else {
        console.warn(`setItemMapper: invalid type or function for "${type}"`);
      }
    },
    getItemMapper: function(type) { return itemMappers[type]; },
    setSkipOnMissingPath: function(flag) { skipOnMissingPath = !!flag; },
    getSkipOnMissingPath: function() { return skipOnMissingPath; }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = TikTokExtractor;
  } else {
    global.TikTokExtractor = TikTokExtractor;
  }
})(typeof window !== "undefined" ? window : this);