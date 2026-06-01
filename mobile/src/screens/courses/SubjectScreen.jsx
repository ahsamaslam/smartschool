import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
} from "react-native";

export default function SubjectScreen({ route, navigation }) {
  const { subjectName, books = [] } = route.params;

  // Build sections per book: book title as a group header, chapters as section headers
  const sections = [];
  for (const book of books) {
    for (const chapter of book.chapters ?? []) {
      const topics = chapter.topics ?? [];
      if (topics.length > 0) {
        sections.push({
          bookTitle: book.title,
          title: `Ch ${chapter.chapter_number}: ${chapter.title}`,
          topicCount: topics.length,
          data: topics,
          isFirstChapterOfBook:
            sections.length === 0 ||
            sections[sections.length - 1].bookTitle !== book.title,
        });
      }
    }
  }

  if (sections.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" }}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>📚</Text>
        <Text style={{ color: "#6B7280", fontSize: 16 }}>No topics found.</Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => String(item.id ?? item.topic_id)}
      style={{ backgroundColor: "#F9FAFB" }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View style={{ marginTop: section.isFirstChapterOfBook ? 0 : 4 }}>
          {/* Book title — shown once per book */}
          {section.isFirstChapterOfBook && (
            <View
              style={{
                backgroundColor: "#4F46E5",
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 18, marginRight: 8 }}>📖</Text>
              <Text
                style={{ color: "#fff", fontWeight: "700", fontSize: 14, flex: 1 }}
                numberOfLines={2}
              >
                {section.bookTitle}
              </Text>
            </View>
          )}
          {/* Chapter header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
              marginTop: 8,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: "#374151",
                flex: 1,
              }}
            >
              {section.title}
            </Text>
            <View
              style={{
                backgroundColor: "#EEF2FF",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text style={{ color: "#4F46E5", fontSize: 11, fontWeight: "600" }}>
                {section.topicCount} {section.topicCount === 1 ? "topic" : "topics"}
              </Text>
            </View>
          </View>
        </View>
      )}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("TopicLearn", {
              topicId: item.id ?? item.topic_id,
              topicName: item.title ?? item.topic_name ?? item.name,
            })
          }
          style={{
            backgroundColor: "#fff",
            borderRadius: 10,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 6,
            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 1,
          }}
        >
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <View style={{ marginRight: 10 }}>
              {item.has_lecture && (
                <Text style={{ fontSize: 13 }}>🎬</Text>
              )}
              {item.has_slides && !item.has_lecture && (
                <Text style={{ fontSize: 13 }}>📊</Text>
              )}
              {!item.has_lecture && !item.has_slides && (
                <Text style={{ fontSize: 13 }}>📝</Text>
              )}
            </View>
            <Text style={{ fontWeight: "500", color: "#111827", fontSize: 14, flex: 1 }}>
              {item.title ?? item.topic_name ?? item.name}
            </Text>
          </View>
          <Text style={{ color: "#9CA3AF", fontSize: 20 }}>›</Text>
        </TouchableOpacity>
      )}
    />
  );
}
