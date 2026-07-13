import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ImageLoadEventData, NativeSyntheticEvent } from 'react-native';
import Colors from '@/constants/colors';
import { ImageJoke } from '@/types';

interface ImageJokeCardProps {
  joke: ImageJoke;
}

export default React.memo(function ImageJokeCard({ joke }: ImageJokeCardProps) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  const handleLoad = (event: NativeSyntheticEvent<ImageLoadEventData>) => {
    const { width, height } = event.nativeEvent.source;
    if (width > 0 && height > 0) {
      setAspectRatio(width / height);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{joke.title}</Text>
      <Image
        source={{ uri: joke.imageUrl }}
        style={[styles.image, aspectRatio != null ? { aspectRatio } : styles.imagePlaceholder]}
        resizeMode="contain"
        onLoad={handleLoad}
        accessibilityLabel={joke.title}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  title: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  image: {
    width: '100%',
    backgroundColor: Colors.surfaceLight,
  },
  imagePlaceholder: {
    minHeight: 180,
  },
});
