import { useState, useEffect, useLayoutEffect, useMemo } from "react";
import "./App.css";

// Remove or comment out the API_BASE_URL constant
// const API_BASE_URL = "http://localhost:8000";

function App() {
  const [messages, setMessages] = useState(new Map());
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState("All");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState(""); // For username search
  const [messageSearchTerm, setMessageSearchTerm] = useState(""); // New state for message text search
  const [activeSearch, setActiveSearch] = useState(""); // Currently active username search
  const [activeMessageSearch, setActiveMessageSearch] = useState(""); // New state for active message text search
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [canLoadNewer, setCanLoadNewer] = useState(false);
  const [canLoadOlder, setCanLoadOlder] = useState(true);
  const [scrollAnchor, setScrollAnchor] = useState(null);
  const [timeSearch, setTimeSearch] = useState("");

  const sortedMessages = useMemo(() => {
    return Array.from(messages.values()).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }, [messages]);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch(`/channels`); // Reverted to relative path
        if (!response.ok) throw new Error("Could not fetch channels");
        const data = await response.json();

        const desiredOrder = [
          "General",
          "Help",
          "Trade",
          "Clan recruiting",
          "Combat-LFG",
          "Raids-LFG",
        ];

        data.sort((a, b) => {
          const indexA = desiredOrder.indexOf(a);
          const indexB = desiredOrder.indexOf(b);
          const effectiveIndexA = indexA === -1 ? Infinity : indexA;
          const effectiveIndexB = indexB === -1 ? Infinity : effectiveIndexB; // Corrected effectiveIndexB
          if (effectiveIndexA !== effectiveIndexB) {
            return effectiveIndexA - effectiveIndexB;
          }
          return a.localeCompare(b);
        });

        setChannels(["All", ...data]);
      } catch (e) {
        console.error(e);
      }
    };
    fetchChannels();
  }, []);

  useEffect(() => {
    if (highlightedMessageId) return;

    const fetchInitialMessages = async () => {
      setIsLoading(true);
      setError(null);
      setCanLoadNewer(false);

      const params = new URLSearchParams();
      if (activeChannel !== "All") params.append("channel_name", activeChannel);
      if (activeSearch) params.append("username", activeSearch);
      if (activeMessageSearch)
        params.append("message_text", activeMessageSearch);

      const queryString = params.toString();
      let url = `/messages${queryString ? `?${queryString}` : ""}`; // Reverted to relative path

      try {
        const response = await fetch(url);
        const data = await response.json();
        setMessages(new Map(data.map((msg) => [msg.id, msg])));
        setCanLoadOlder(data.length > 0);
      } catch (e) {
        setError("Failed to load messages.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialMessages();
  }, [activeChannel, activeSearch, activeMessageSearch]);

  useLayoutEffect(() => {
    if (scrollAnchor?.id) {
      const element = document.getElementById(`message-${scrollAnchor.id}`);
      if (element) {
        element.scrollIntoView({ behavior: "auto", block: "start" });
      }
      setScrollAnchor(null);
    }
  }, [messages, scrollAnchor]);

  useEffect(() => {
    if (highlightedMessageId) {
      const element = document.getElementById(
        `message-${highlightedMessageId}`
      );
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        const timer = setTimeout(() => setHighlightedMessageId(null), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [messages, highlightedMessageId]);

  const handleUsernameSearchSubmit = (e) => {
    e.preventDefault();
    setActiveChannel("All");
    setActiveSearch(searchTerm);
    setActiveMessageSearch(""); // Clear message search when performing username search
    setMessageSearchTerm("");
  };

  const handleMessageSearchSubmit = (e) => {
    e.preventDefault();
    setActiveChannel("All");
    setActiveMessageSearch(messageSearchTerm);
    setActiveSearch(""); // Clear username search when performing message search
    setSearchTerm("");
  };

  const clearSearch = () => {
    setSearchTerm("");
    setActiveSearch("");
    setMessageSearchTerm("");
    setActiveMessageSearch("");
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
    }) +
    ", " +
    new Date(d).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

  const handleUsernameClick = (username) => {
    setSearchTerm(username);
    setActiveSearch(username);
    setActiveMessageSearch(""); // Clear message search when clicking username
    setMessageSearchTerm("");
    setActiveChannel("All"); // Reset channel to "All" for user search context
  };

  const handleJumpToTime = async (timestamp, messageId, channelName) => {
    setIsLoading(true);
    setError(null);
    setActiveSearch("");
    setSearchTerm("");
    setActiveMessageSearch("");
    setMessageSearchTerm("");
    setHighlightedMessageId(messageId);
    setActiveChannel(channelName);
    setCanLoadNewer(true);
    setCanLoadOlder(true);

    try {
      const params = new URLSearchParams();
      params.append("target_timestamp", timestamp);
      params.append("channel_name", channelName);

      const url = `/messages_around_time?${params.toString()}`; // Reverted to relative path
      const response = await fetch(url);
      const data = await response.json();
      setMessages(new Map(data.map((msg) => [msg.id, msg])));
    } catch (e) {
      setError("Failed to load message context.");
      setHighlightedMessageId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeSearchSubmit = async (event) => {
    event.preventDefault();
    if (!timeSearch) return;

    setIsLoading(true);
    setError(null);
    setActiveSearch("");
    setSearchTerm("");
    setActiveMessageSearch("");
    setMessageSearchTerm("");
    setHighlightedMessageId(null);
    setCanLoadNewer(true);
    setCanLoadOlder(true);

    try {
      const localDate = new Date(timeSearch);
      const utcTimestamp = localDate.toISOString();

      const params = new URLSearchParams();
      params.append("target_timestamp", utcTimestamp);

      if (activeChannel !== "All") {
        params.append("channel_name", activeChannel);
      }

      const url = `/messages_around_time?${params.toString()}`; // Reverted to relative path

      const response = await fetch(url);
      if (!response.ok)
        throw new Error("Could not fetch messages for this time.");
      const data = await response.json();
      setMessages(new Map(data.map((msg) => [msg.id, msg])));
      document.querySelector(".chat-log")?.scrollTo(0, 0);
    } catch (e) {
      setError("Failed to load messages for this time.");
    } finally {
      setIsLoading(false);
    }
  };

  const mergeMessages = (newMessages) => {
    setMessages((prevMap) => {
      const newMap = new Map(prevMap);
      newMessages.forEach((msg) => {
        newMap.set(msg.id, msg);
      });
      return newMap;
    });
  };

  const handleLoadOlder = async () => {
    if (isLoadingMore || sortedMessages.length === 0) return;
    setIsLoadingMore(true);

    const oldestTimestamp =
      sortedMessages[sortedMessages.length - 1]?.created_at;
    const params = new URLSearchParams();
    params.append("before_timestamp", oldestTimestamp);
    if (activeChannel !== "All") params.append("channel_name", activeChannel);
    if (activeSearch) params.append("username", activeSearch);
    if (activeMessageSearch) params.append("message_text", activeMessageSearch);

    const url = `/messages?${params.toString()}`; // Reverted to relative path
    const response = await fetch(url);
    const olderMessages = await response.json();

    if (olderMessages.length > 0) {
      mergeMessages(olderMessages);
    } else {
      setCanLoadOlder(false);
    }
    setIsLoadingMore(false);
  };

  const handleLoadNewer = async () => {
    if (isLoadingMore || sortedMessages.length === 0) return;
    setIsLoadingMore(true);
    setScrollAnchor({ id: sortedMessages[0]?.id });

    const newestTimestamp = sortedMessages[0]?.created_at;
    const params = new URLSearchParams();
    params.append("after_timestamp", newestTimestamp);
    if (activeChannel !== "All") params.append("channel_name", activeChannel);
    if (activeSearch) params.append("username", activeSearch);
    if (activeMessageSearch) params.append("message_text", activeMessageSearch);

    const url = `/messages?${params.toString()}`; // Reverted to relative path
    const response = await fetch(url);
    const newerMessages = await response.json();

    if (newerMessages.length > 0) {
      mergeMessages(newerMessages);
    } else {
      setCanLoadNewer(false);
    }
    setIsLoadingMore(false);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Idle Clans Chat Log</h1>
        <div className="search-forms-container">
          <form onSubmit={handleUsernameSearchSubmit} className="search-bar">
            <input
              type="text"
              placeholder="Search by username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-btn">
              Search
            </button>
            {(activeSearch || activeMessageSearch) && (
              <button type="button" onClick={clearSearch} className="clear-btn">
                Clear
              </button>
            )}
          </form>

          {/* New Message Search Form */}
          <form onSubmit={handleMessageSearchSubmit} className="search-bar">
            <input
              type="text"
              placeholder="Search by message text..."
              value={messageSearchTerm}
              onChange={(e) => setMessageSearchTerm(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-btn">
              Search
            </button>
            {(activeSearch || activeMessageSearch) && (
              <button type="button" onClick={clearSearch} className="clear-btn">
                Clear
              </button>
            )}
          </form>

          <form onSubmit={handleTimeSearchSubmit} className="time-search-bar">
            <input
              type="datetime-local"
              className="time-input"
              value={timeSearch}
              onChange={(e) => setTimeSearch(e.target.value)}
              title="Select a date and time"
            />
            <button type="submit" className="search-btn">
              Go
            </button>
          </form>
        </div>
        <nav className="channel-nav">
          {channels.map((channel) => (
            <button
              key={channel}
              className={`channel-btn ${
                activeChannel === channel ? "active" : ""
              }`}
              onClick={() => {
                setActiveChannel(channel);
                clearSearch();
              }}
            >
              {channel}
            </button>
          ))}
        </nav>
      </header>
      <main className="chat-log">
        {canLoadNewer && !isLoading && (
          <div className="load-more-container">
            <button
              onClick={handleLoadNewer}
              disabled={isLoadingMore}
              className="load-more-btn"
            >
              {isLoadingMore ? "Loading..." : "Load Newer Messages"}
            </button>
          </div>
        )}

        {isLoading ? (
          <p>Loading messages...</p>
        ) : (
          sortedMessages.map((msg) => (
            <div
              key={msg.id}
              id={`message-${msg.id}`}
              className={`chat-message ${
                msg.id === highlightedMessageId ? "highlighted-message" : ""
              }`}
            >
              <div className="message-content">
                <span className="timestamp">{formatDate(msg.created_at)}</span>
                <span className="channel-name">[{msg.channel_name}]</span>
                <span
                  className="username"
                  onClick={() => handleUsernameClick(msg.username)}
                >
                  {msg.username}:
                </span>
                <p className="message-body">{msg.message}</p>
              </div>
              {(activeSearch || activeMessageSearch) && (
                <div className="message-actions">
                  <button
                    onClick={() =>
                      handleJumpToTime(msg.created_at, msg.id, msg.channel_name)
                    }
                    className="jump-btn"
                  >
                    Jump
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {!isLoading && messages.size === 0 && <p>No messages found.</p>}

        {canLoadOlder && !isLoading && messages.size > 0 && (
          <div className="load-more-container">
            <button
              onClick={handleLoadOlder}
              disabled={isLoadingMore}
              className="load-more-btn"
            >
              {isLoadingMore ? "Loading..." : "Load Older Messages"}
            </button>
          </div>
        )}

        {error && <p className="error-message">{error}</p>}
      </main>
    </div>
  );
}

export default App;
