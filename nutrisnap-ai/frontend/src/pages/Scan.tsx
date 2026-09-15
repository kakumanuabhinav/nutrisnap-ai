import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UploadArea, ScanLoader } from "../components/FoodScanner";
import { ServingSelector } from "../components/ServingSelector";
import { HealthInsights, MacroCard } from "../components/shared";
import { aiService } from "../services/aiService";
import { mealService } from "../services/mealService";
import { ApiError } from "../services/apiClient";
import { renderNutritionCard, shareOrCopyImage, exportAnalysisPdf } from "../utils/nutritionCard";
import type { FoodAnalysis } from "../types";

type Stage = "idle" | "preview" | "scanning" | "result" | "error";
type MealType = "breakfast" | "lunch" | "dinner" | "snack";

function scaleValue(value: number, multiplier: number) {
  return Math.round(value * multiplier * 10) / 10;
}

export function Scan() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("idle");
  const [scanStep, setScanStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [mealType, setMealType] = useState<MealType>("snack");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const requestInFlight = useRef(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileSelected(selected: File) {
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setStage("preview");
    setLogged(false);
  }

  async function handleAnalyze() {
    if (!file || requestInFlight.current) return; // prevent duplicate requests
    requestInFlight.current = true;
    setStage("scanning");
    setErrorMsg(null);
    setScanStep(0);

    const stepTimer = setInterval(() => {
      setScanStep((s) => Math.min(s + 1, 2));
    }, 900);

    try {
      const result = await aiService.analyzeFood(file);
      setAnalysis(result.analysis);
      setImageUrl(result.image_url);
      setScanStep(3);
      setTimeout(() => setStage("result"), 400);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to analyze the image. Please try again.";
      setErrorMsg(message);
      setStage("error");
    } finally {
      clearInterval(stepTimer);
      requestInFlight.current = false;
    }
  }

  function handleRetry() {
    setStage(file ? "preview" : "idle");
    setErrorMsg(null);
  }

  function handleReset() {
    setFile(null);
    setPreviewUrl(null);
    setAnalysis(null);
    setImageUrl(null);
    setMultiplier(1);
    setMealType("snack");
    setStage("idle");
    setLogged(false);
  }

  async function handleLogMeal() {
    if (!analysis) return;
    setLogging(true);
    try {
      await mealService.logMeal({
        meal_type: mealType,
        image_url: imageUrl,
        summary: analysis.summary,
        serving_multiplier: multiplier,
        nutrition: analysis.nutrition,
        detected_foods: analysis.detected_foods,
        insights: analysis.insights,
      });
      setLogged(true);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not save meal. Please try again.");
    } finally {
      setLogging(false);
    }
  }

  async function handleShare() {
    if (!analysis) return;
    await shareOrCopyImage(renderNutritionCard(analysis, multiplier), "NutriSnap AI nutrition report");
  }

  function handleSaveImage() {
    if (!analysis) return;
    const link = document.createElement("a");
    link.href = renderNutritionCard(analysis, multiplier);
    link.download = "nutrisnap-card.png";
    link.click();
  }

  function handleCopyResults() {
    if (!analysis) return;
    const n = analysis.nutrition;
    const text = `${analysis.summary}\nCalories: ${scaleValue(n.calories, multiplier)} kcal\nProtein: ${scaleValue(n.protein, multiplier)}g · Carbs: ${scaleValue(n.carbs, multiplier)}g · Fat: ${scaleValue(n.fat, multiplier)}g · Fiber: ${scaleValue(n.fiber, multiplier)}g`;
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-8">
      <h1 className="text-2xl font-bold mb-1">Scan Meal</h1>
      <p className="text-white/40 text-sm mb-6">Snap or upload a photo to get instant nutrition.</p>

      {stage === "idle" && <UploadArea onFileSelected={handleFileSelected} />}

      {stage === "preview" && previewUrl && (
        <div className="flex flex-col gap-4">
          <div className="card p-2">
            <img src={previewUrl} alt="Food preview" className="w-full rounded-xl max-h-96 object-cover" />
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={handleReset}>
              Remove
            </button>
            <button className="btn-primary flex-1" onClick={handleAnalyze}>
              Analyze
            </button>
          </div>
        </div>
      )}

      {stage === "scanning" && <ScanLoader stage={scanStep} />}

      {stage === "error" && (
        <div className="card flex flex-col items-center gap-4 py-10 text-center">
          <div className="text-3xl">⚠️</div>
          <div className="text-white/70">{errorMsg}</div>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={handleReset}>
              Start Over
            </button>
            <button className="btn-primary" onClick={handleRetry}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {stage === "result" && analysis && (
        <div className="flex flex-col gap-5">
          {previewUrl && (
            <div className="card p-2">
              <img src={previewUrl} alt="" className="w-full rounded-xl max-h-72 object-cover" />
            </div>
          )}

          <div className="card">
            <div className="text-xs text-white/40 mb-2">Detected Foods</div>
            <div className="flex flex-col gap-2">
              {analysis.detected_foods.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{f.name}</span>
                  <span className="text-white/40 text-xs">
                    {f.estimated_quantity ? `${f.estimated_quantity} · ` : ""}
                    {f.confidence}% confidence
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card text-center">
            <div className="text-5xl font-bold text-cyan-accent">
              {scaleValue(analysis.nutrition.calories, multiplier)}
            </div>
            <div className="text-white/40 text-sm mt-1">calories</div>
          </div>

          <div>
            <div className="text-xs text-white/40 mb-2">Serving Size</div>
            <ServingSelector value={multiplier} onChange={setMultiplier} />
          </div>

          <div className="grid grid-cols-4 gap-3">
            <MacroCard label="Protein" value={scaleValue(analysis.nutrition.protein, multiplier)} />
            <MacroCard label="Carbs" value={scaleValue(analysis.nutrition.carbs, multiplier)} />
            <MacroCard label="Fat" value={scaleValue(analysis.nutrition.fat, multiplier)} />
            <MacroCard label="Fiber" value={scaleValue(analysis.nutrition.fiber, multiplier)} />
          </div>

          <div className="card">
            <div className="text-xs text-white/40 mb-3">Micronutrients</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between"><span className="text-white/50">Sugar</span><span>{scaleValue(analysis.nutrition.sugar, multiplier)}g</span></div>
              <div className="flex justify-between"><span className="text-white/50">Sodium</span><span>{scaleValue(analysis.nutrition.sodium, multiplier)}mg</span></div>
              <div className="flex justify-between"><span className="text-white/50">Potassium</span><span>{scaleValue(analysis.nutrition.potassium, multiplier)}mg</span></div>
              <div className="flex justify-between"><span className="text-white/50">Saturated Fat</span><span>{scaleValue(analysis.nutrition.saturated_fat, multiplier)}g</span></div>
              <div className="flex justify-between"><span className="text-white/50">Cholesterol</span><span>{scaleValue(analysis.nutrition.cholesterol, multiplier)}mg</span></div>
            </div>
          </div>

          <div>
            <div className="text-xs text-white/40 mb-2">Health Insights</div>
            <HealthInsights insights={analysis.insights} />
          </div>

          <div>
            <div className="text-xs text-white/40 mb-2">Meal Type</div>
            <div className="flex gap-2">
              {(["breakfast", "lunch", "dinner", "snack"] as MealType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setMealType(type)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border capitalize transition ${
                    mealType === type ? "bg-cyan-accent text-black border-cyan-accent" : "border-white/10 text-white/60"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && <div className="text-sm text-danger">{errorMsg}</div>}

          {logged ? (
            <div className="card border-good/30 bg-good/5 text-good text-center text-sm py-4 flex flex-col gap-3">
              ✓ Meal logged to your tracker
              <div className="flex gap-3 justify-center">
                <button className="btn-secondary text-xs" onClick={() => navigate("/app/dashboard")}>
                  Go to Dashboard
                </button>
                <button className="btn-secondary text-xs" onClick={handleReset}>
                  Scan Another
                </button>
              </div>
            </div>
          ) : (
            <button className="btn-primary w-full" onClick={handleLogMeal} disabled={logging}>
              {logging ? "Saving…" : "Log Meal"}
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button className="btn-secondary text-sm" onClick={handleReset}>
              Scan Again
            </button>
            <button className="btn-secondary text-sm" onClick={handleShare}>
              Share
            </button>
            <button className="btn-secondary text-sm" onClick={handleSaveImage}>
              Save Image
            </button>
            <button className="btn-secondary text-sm" onClick={() => exportAnalysisPdf(analysis, multiplier)}>
              Export PDF
            </button>
            <button className="btn-secondary text-sm col-span-2" onClick={handleCopyResults}>
              Copy Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
