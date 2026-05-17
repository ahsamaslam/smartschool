import { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
  FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function SlidesViewerScreen({ route }) {
  const navigation = useNavigation();
  const { slides = [], topicName = "Slides" } = route.params ?? {};
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  const goToSlide = (index) => {
    if (index < 0 || index >= slides.length) return;
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1E1B4B" }}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* Top Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: "#fff", fontSize: 16 }}>✕</Text>
        </TouchableOpacity>
        <Text
          style={{ color: "#fff", fontWeight: "600", flex: 1 }}
          numberOfLines={1}
        >
          {topicName}
        </Text>
        <Text style={{ color: "#A5B4FC", fontSize: 13 }}>
          {currentIndex + 1} / {slides.length}
        </Text>
      </View>

      {/* Slides Carousel */}
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(idx);
        }}
        renderItem={({ item: slide }) => (
          <View
            style={{
              width: SCREEN_WIDTH,
              flex: 1,
              justifyContent: "center",
              padding: 24,
            }}
          >
            <SlideCard slide={slide} />
          </View>
        )}
      />

      {/* Navigation Arrows */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => goToSlide(currentIndex - 1)}
          disabled={currentIndex === 0}
          style={{
            backgroundColor: currentIndex === 0 ? "#374151" : "#4F46E5",
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>‹ Prev</Text>
        </TouchableOpacity>

        {/* Dot Indicators */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {slides.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goToSlide(i)}>
              <View
                style={{
                  width: i === currentIndex ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i === currentIndex ? "#A5B4FC" : "#374151",
                }}
              />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => goToSlide(currentIndex + 1)}
          disabled={currentIndex === slides.length - 1}
          style={{
            backgroundColor:
              currentIndex === slides.length - 1 ? "#374151" : "#4F46E5",
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Next ›</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function SlideCard({ slide }) {
  const layout = slide.layout ?? "title_content";

  return (
    <View
      style={{
        backgroundColor: slide.background_color ?? "#fff",
        borderRadius: 16,
        padding: 28,
        minHeight: 320,
        justifyContent: "center",
      }}
    >
      {/* Title */}
      {slide.title && (
        <Text
          style={{
            fontSize: layout === "title_only" ? 28 : 22,
            fontWeight: "bold",
            color: slide.text_color ?? "#1E1B4B",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          {slide.title}
        </Text>
      )}

      {/* Content Blocks */}
      {slide.content_blocks?.map((block, idx) => {
        if (block.type === "text" || block.type === "paragraph") {
          return (
            <Text
              key={idx}
              style={{
                color: slide.text_color ?? "#374151",
                fontSize: 15,
                lineHeight: 24,
                marginBottom: 8,
              }}
            >
              {block.content ?? block.text}
            </Text>
          );
        }
        if (block.type === "bullet_list" || block.type === "bullet") {
          const items = Array.isArray(block.items)
            ? block.items
            : (block.content ?? "").split("\n").filter(Boolean);
          return (
            <View key={idx} style={{ marginBottom: 8 }}>
              {items.map((item, j) => (
                <View
                  key={j}
                  style={{
                    flexDirection: "row",
                    marginBottom: 4,
                    paddingLeft: 8,
                  }}
                >
                  <Text style={{ color: "#4F46E5", marginRight: 8 }}>•</Text>
                  <Text
                    style={{
                      color: slide.text_color ?? "#374151",
                      flex: 1,
                      lineHeight: 22,
                    }}
                  >
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return null;
      })}
    </View>
  );
}
